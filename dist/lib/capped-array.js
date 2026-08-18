// src/lib/capped-array.ts
var CappedArray = class extends Array {
  /**
   * Derived collections (`map`/`filter`/`slice`/`splice`'s removed-elements
   * array) are returned as PLAIN `Array`s, not `CappedArray`s. This avoids two
   * footguns of subclassing Array: (1) species construction would call
   * `new CappedArray()` with no `maxSize` → throws, and (2) it would saddle read
   * results with a misleading cap. Reads get a normal array; the cap lives only
   * on the original bounded collection.
   */
  static get [Symbol.species]() {
    return Array;
  }
  constructor(maxSize) {
    super();
    if (!Number.isFinite(maxSize) || maxSize < 0) {
      throw new RangeError(
        `CappedArray: maxSize must be a non-negative finite number, got ${maxSize}`
      );
    }
    this.maxSize = Math.floor(maxSize);
  }
  /**
   * Evict oldest entries from the front until `length <= maxSize`.
   * Called after every mutating insert.
   */
  enforceCap() {
    const overflow = this.length - this.maxSize;
    if (overflow > 0) super.splice(0, overflow);
  }
  /**
   * Append `items` and evict the oldest entries that overflow the cap.
   * Always caps — this is the structural guarantee that kills the sibling bug.
   */
  push(...items) {
    super.push(...items);
    this.enforceCap();
    return this.length;
  }
  /**
   * Prepend `items` (newest first) and evict the oldest entries — which, after
   * an unshift, sit at the TAIL — so the most-recently-added items are retained.
   */
  unshift(...items) {
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
  splice(start, deleteCount, ...items) {
    const removed = deleteCount === void 0 ? super.splice(start) : super.splice(start, deleteCount, ...items);
    this.enforceCap();
    return removed;
  }
  /**
   * Replace the entire contents in one shot, keeping only the NEWEST entries
   * that fit under the cap. Use this in place of `this.x = filtered` / `= []` so
   * the field keeps its `CappedArray` identity (and cap).
   */
  replaceWith(items) {
    this.length = 0;
    const start = Math.max(0, items.length - this.maxSize);
    for (let i = start; i < items.length; i++) super.push(items[i]);
    return this;
  }
  /** Remove every entry without dropping the cap. Alias for `length = 0`. */
  clear() {
    this.length = 0;
  }
};
export {
  CappedArray
};
