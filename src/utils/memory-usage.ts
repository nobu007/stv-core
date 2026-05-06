/**
 * Cross-platform memory usage utility (ISS-006)
 *
 * Provides heap memory metrics in both Node.js and browser environments.
 * In Node.js, uses process.memoryUsage().
 * In Chrome-based browsers, uses performance.memory.
 * Otherwise returns 0 (no metric available).
 */

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  /** Bytes — 0 when unavailable */
  rss?: number;
}

/**
 * Returns heap memory usage in bytes, or { heapUsed: 0, heapTotal: 0 } when
 * the runtime exposes no memory API.
 */
export function getMemoryUsage(): MemoryMetrics {
  // Node.js
  if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
    const mem = process.memoryUsage();
    return { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, rss: mem.rss };
  }

  // Chrome-only non-standard API
  const perf = performance as unknown as {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  if (perf.memory) {
    return { heapUsed: perf.memory.usedJSHeapSize, heapTotal: perf.memory.totalJSHeapSize };
  }

  return { heapUsed: 0, heapTotal: 0 };
}

/** Convenience: returns just heapUsed (bytes), or 0 when unavailable. */
export function getHeapUsed(): number {
  return getMemoryUsage().heapUsed;
}
