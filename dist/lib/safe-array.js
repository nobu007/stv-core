// src/lib/safe-array.ts
function safeArray(arr) {
  return arr ?? [];
}
function safeMap(arr, fn) {
  return (arr ?? []).map(fn);
}
function safeJoin(arr, separator) {
  return (arr ?? []).join(separator);
}
export {
  safeArray,
  safeJoin,
  safeMap
};
