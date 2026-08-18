/**
 * Cross-platform memory usage utility (ISS-006)
 *
 * Provides heap memory metrics in both Node.js and browser environments.
 * In Node.js, uses process.memoryUsage().
 * In Chrome-based browsers, uses performance.memory.
 * Otherwise returns 0 (no metric available).
 */
/**
 * Returns heap memory usage in bytes, or { heapUsed: 0, heapTotal: 0 } when
 * the runtime exposes no memory API.
 */
export function getMemoryUsage() {
    // Node.js
    if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
        const mem = process.memoryUsage();
        return { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, rss: mem.rss, external: mem.external };
    }
    // Chrome-only non-standard API
    const perf = performance;
    if (perf.memory) {
        return { heapUsed: perf.memory.usedJSHeapSize, heapTotal: perf.memory.totalJSHeapSize };
    }
    return { heapUsed: 0, heapTotal: 0 };
}
/** Convenience: returns just heapUsed (bytes), or 0 when unavailable. */
export function getHeapUsed() {
    return getMemoryUsage().heapUsed;
}
