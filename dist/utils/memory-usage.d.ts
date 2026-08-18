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
    /** Bytes — 0 when unavailable */
    external?: number;
}
/**
 * Returns heap memory usage in bytes, or { heapUsed: 0, heapTotal: 0 } when
 * the runtime exposes no memory API.
 */
export declare function getMemoryUsage(): MemoryMetrics;
/** Convenience: returns just heapUsed (bytes), or 0 when unavailable. */
export declare function getHeapUsed(): number;
