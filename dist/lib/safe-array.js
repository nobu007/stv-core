/**
 * Safe array utilities — guard against null/undefined receivers on .map(), .join(), etc.
 *
 * These are intentionally minimal: they normalise nullable arrays to empty arrays
 * so that downstream .map()/.join()/.forEach() calls never throw at runtime.
 */
/** Return the array if truthy, otherwise an empty array. */
export function safeArray(arr) {
    return (arr ?? []);
}
/** Like Array.prototype.map but returns [] when the receiver is null/undefined. */
export function safeMap(arr, fn) {
    return (arr ?? []).map(fn);
}
/** Like Array.prototype.join but returns '' when the receiver is null/undefined. */
export function safeJoin(arr, separator) {
    return (arr ?? []).join(separator);
}
