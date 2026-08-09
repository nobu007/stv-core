/**
 * CappedMap — a FIFO-bounded Map that evicts the OLDEST entries on every
 * `set`, so a capacity cap can never be "forgotten" at a new insert site.
 *
 * WHY THIS EXISTS — the "no-cap sibling" bug class, for the Map half
 * -----------------------------------------------------------------
 * `CappedArray` (src/lib/capped-array.ts) structurally capped ARRAY histories.
 * But process-lifetime singletons also keep Maps keyed by an UNBOUNDED id space
 * (job ids, error ids, compound keys, route strings). The same defect recurred
 * there: a hand-rolled cap lived at ONE `set` site,
 *
 *   private jobs = new Map<string, Job>();
 *   ...
 *   this.jobs.set(id, job);                       // site A
 *   if (this.jobs.size > MAX) this.jobs.delete(this.jobs.keys().next().value);
 *
 * and a second `set` site (B) added later came WITHOUT the trailing cap →
 * unbounded growth on a singleton that lives for the whole process.
 *
 * `CappedMap` makes the cap STRUCTURAL: `set` always evicts the
 * oldest-INSERTED entry when the size would exceed `maxSize`, so no future
 * mutation path can grow the collection past its cap — regardless of how many
 * `set` sites are added. This is the direct Map analog of `CappedArray`.
 *
 * Migration is intentionally low-churn: because this class `extends Map<K,V>`,
 * every read path works unchanged (`get`, `has`, `size`, `forEach`,
 * `for...of`, spread `[...map]`, `keys/values/entries`). The only change is the
 * initializer — `new Map()` → `new CappedMap<K,V>(MAX)` — and deleting the
 * now-redundant `if (size > MAX) delete(firstKey)` lines.
 *
 * Eviction policy is FIFO (oldest INSERTION). For LRU (recency-based) use
 * cases — where `get` must promote recency and eviction follows access order —
 * keep a dedicated cache (e.g. ExportArtifactStore's access-sequence LRU);
 * FIFO here is the structural analog of `CappedArray` and matches history and
 * id-registry collections.
 *
 * For filter/reset operations that previously REASSIGNED the field
 * (`this.x = filteredMap` / `this.x = new Map()`), use `replaceWith()` /
 * `clear()` instead: those preserve the `CappedMap` identity so the collection
 * can never silently downgrade back to a plain uncapped `Map`.
 */
export class CappedMap<K, V> extends Map<K, V> {
  /** Maximum number of entries retained; enforced on every `set`. */
  readonly maxSize: number;

  /**
   * @param maxSize  Maximum entries retained. Must be a non-negative finite
   *                 number (fractional values are floored).
   * @param entries  Optional initial entries; routed through `set`, so only the
   *                 NEWEST `maxSize` entries are retained when they overflow.
   */
  constructor(
    maxSize: number,
    entries?: ReadonlyArray<readonly [K, V]> | null,
  ) {
    super();
    if (!Number.isFinite(maxSize) || maxSize < 0) {
      throw new RangeError(
        `CappedMap: maxSize must be a non-negative finite number, got ${maxSize}`,
      );
    }
    this.maxSize = Math.floor(maxSize);
    if (entries) {
      for (const [k, v] of entries) this.set(k, v);
    }
  }

  /**
   * Set `key → value` and, if this INSERTS a new key that overflows the cap,
   * evict the oldest-inserted entry. Re-setting an EXISTING key updates its
   * value in place (standard `Map` semantics — insertion order is preserved,
   * no eviction, no size growth).
   *
   * Always caps — this is the structural guarantee that kills the sibling bug.
   * The cap is enforced AFTER the insert (mirroring `CappedArray.enforceCap`),
   * which correctly handles `maxSize === 0` (the just-inserted entry is evicted
   * immediately, so nothing is ever retained).
   */
  set(key: K, value: V): this {
    const isNew = !super.has(key);
    super.set(key, value);
    if (isNew) this.enforceCap();
    return this;
  }

  /**
   * Evict oldest-INSERTED entries from the front until `size <= maxSize`.
   * Called after every new-key insert. `Map` iteration yields keys in insertion
   * order, so `keys().next().value` is the oldest; the just-inserted key sits at
   * the tail and is retained.
   */
  private enforceCap(): void {
    let overflow = super.size - this.maxSize;
    while (overflow > 0) {
      const oldest = super.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      super.delete(oldest);
      overflow--;
    }
  }

  /**
   * Replace the entire contents in one shot, keeping only the NEWEST entries
   * that fit under the cap. Use this in place of `this.x = filteredMap` /
   * `= new Map(...)` so the field keeps its `CappedMap` identity (and cap).
   */
  replaceWith(entries: Iterable<readonly [K, V]>): this {
    super.clear();
    for (const [k, v] of entries) this.set(k, v);
    return this;
  }

  /** Remove every entry without dropping the cap. Inherited `clear` is fine. */
}
