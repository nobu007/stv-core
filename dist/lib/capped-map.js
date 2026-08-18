// src/lib/capped-map.ts
var CappedMap = class extends Map {
  /**
   * @param maxSize  Maximum entries retained. Must be a non-negative finite
   *                 number (fractional values are floored).
   * @param entries  Optional initial entries; routed through `set`, so only the
   *                 NEWEST `maxSize` entries are retained when they overflow.
   */
  constructor(maxSize, entries) {
    super();
    if (!Number.isFinite(maxSize) || maxSize < 0) {
      throw new RangeError(
        `CappedMap: maxSize must be a non-negative finite number, got ${maxSize}`
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
  set(key, value) {
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
  enforceCap() {
    let overflow = super.size - this.maxSize;
    while (overflow > 0) {
      const oldest = super.keys().next().value;
      if (oldest === void 0) break;
      super.delete(oldest);
      overflow--;
    }
  }
  /**
   * Replace the entire contents in one shot, keeping only the NEWEST entries
   * that fit under the cap. Use this in place of `this.x = filteredMap` /
   * `= new Map(...)` so the field keeps its `CappedMap` identity (and cap).
   */
  replaceWith(entries) {
    super.clear();
    for (const [k, v] of entries) this.set(k, v);
    return this;
  }
  /** Remove every entry without dropping the cap. Inherited `clear` is fine. */
};
export {
  CappedMap
};
