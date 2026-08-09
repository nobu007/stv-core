/**
 * CappedArray — a FIFO-bounded array that evicts the OLDEST entries on every
 * insert, so a capacity cap can never be "forgotten" at a new push site.
 *
 * WHY THIS EXISTS — the recurring "no-cap sibling" bug class
 * ----------------------------------------------------------
 * Process-lifetime singletons kept a history collection with a hand-rolled cap
 * at ONE push site:
 *
 *   private history: T[] = [];
 *   ...
 *   this.history.push(item);                       // site A
 *   if (this.history.length > MAX) this.history.shift();
 *
 * Then a second push site (B) was added later WITHOUT the trailing cap →
 * unbounded memory growth on a singleton that lives for the whole process.
 * Each instance was patched reactively (commit subjects kept reading "no-cap
 * sibling"), and the same defect kept reappearing in the next module.
 *
 * `CappedArray` makes the cap STRUCTURAL: `push` / `unshift` / `splice`-insert
 * always enforce FIFO eviction, so no future mutation path can grow the
 * collection past its cap — regardless of how many push sites are added.
 *
 * Migration is intentionally low-churn: because this class `extends Array<T>`,
 * every read path works unchanged (indexing `arr[i]`, spread `[...arr]`,
 * `.map/.filter/.find/.reduce`, `for...of`, `.length`). The only change is the
 * initializer — `[]` → `new CappedArray<T>(MAX)` — and deleting the now-redundant
 * `if (length > MAX) shift()` lines.
 *
 * For filter/reset operations that previously REASSIGNED the field
 * (`this.x = this.x.filter(...)` / `this.x = []`), use `replaceWith()` / `clear()`
 * instead: those preserve the `CappedArray` identity so the collection can never
 * silently downgrade back to a plain uncapped array.
 */

/**
 * A FIFO-bounded array. Oldest entries are evicted automatically whenever the
 * length would exceed `maxSize`. Behaves as a plain `Array<T>` for all reads.
 */
export class CappedArray<T> extends Array<T> {
  /** Maximum number of entries retained; enforced on every insert. */
  readonly maxSize: number;

  /**
   * Derived collections (`map`/`filter`/`slice`/`splice`'s removed-elements
   * array) are returned as PLAIN `Array`s, not `CappedArray`s. This avoids two
   * footguns of subclassing Array: (1) species construction would call
   * `new CappedArray()` with no `maxSize` → throws, and (2) it would saddle read
   * results with a misleading cap. Reads get a normal array; the cap lives only
   * on the original bounded collection.
   */
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  constructor(maxSize: number) {
    super();
    if (!Number.isFinite(maxSize) || maxSize < 0) {
      throw new RangeError(
        `CappedArray: maxSize must be a non-negative finite number, got ${maxSize}`,
      );
    }
    this.maxSize = Math.floor(maxSize);
  }

  /**
   * Evict oldest entries from the front until `length <= maxSize`.
   * Called after every mutating insert.
   */
  private enforceCap(): void {
    const overflow = this.length - this.maxSize;
    if (overflow > 0) super.splice(0, overflow);
  }

  /**
   * Append `items` and evict the oldest entries that overflow the cap.
   * Always caps — this is the structural guarantee that kills the sibling bug.
   */
  push(...items: T[]): number {
    super.push(...items);
    this.enforceCap();
    return this.length;
  }

  /**
   * Prepend `items` (newest first) and evict the oldest entries — which, after
   * an unshift, sit at the TAIL — so the most-recently-added items are retained.
   */
  unshift(...items: T[]): number {
    super.unshift(...items);
    const overflow = this.length - this.maxSize;
    if (overflow > 0) super.splice(this.maxSize, overflow);
    return this.length;
  }

  /**
   * splice with optional insert. The cap is re-enforced after the call: for a
   * pure deletion `enforceCap` is a no-op (length only shrank), and after an
   * insert it evicts the oldest entries that overflow the cap.
   */
  splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    const removed =
      deleteCount === undefined
        ? super.splice(start) // (start) — delete-to-end form
        : super.splice(start, deleteCount, ...items);
    this.enforceCap();
    return removed;
  }

  /**
   * Replace the entire contents in one shot, keeping only the NEWEST entries
   * that fit under the cap. Use this in place of `this.x = filtered` / `= []` so
   * the field keeps its `CappedArray` identity (and cap).
   */
  replaceWith(items: readonly T[]): this {
    this.length = 0;
    const start = Math.max(0, items.length - this.maxSize);
    for (let i = start; i < items.length; i++) super.push(items[i]);
    return this;
  }

  /** Remove every entry without dropping the cap. Alias for `length = 0`. */
  clear(): void {
    this.length = 0;
  }
}
