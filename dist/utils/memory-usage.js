// src/utils/memory-usage.ts
function getMemoryUsage() {
  if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
    const mem = process.memoryUsage();
    return { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, rss: mem.rss, external: mem.external };
  }
  const perf = performance;
  if (perf.memory) {
    return { heapUsed: perf.memory.usedJSHeapSize, heapTotal: perf.memory.totalJSHeapSize };
  }
  return { heapUsed: 0, heapTotal: 0 };
}
function getHeapUsed() {
  return getMemoryUsage().heapUsed;
}
export {
  getHeapUsed,
  getMemoryUsage
};
