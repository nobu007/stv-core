/**
 * Safe array utilities — guard against null/undefined receivers on .map(), .join(), etc.
 *
 * These are intentionally minimal: they normalise nullable arrays to empty arrays
 * so that downstream .map()/.join()/.forEach() calls never throw at runtime.
 */
/** Return the array if truthy, otherwise an empty array. */
export declare function safeArray<T>(arr: readonly T[] | null | undefined): T[];
/** Like Array.prototype.map but returns [] when the receiver is null/undefined. */
export declare function safeMap<T, U>(arr: readonly T[] | null | undefined, fn: (item: T, index: number) => U): U[];
/** Like Array.prototype.join but returns '' when the receiver is null/undefined. */
export declare function safeJoin(arr: readonly string[] | null | undefined, separator: string): string;
