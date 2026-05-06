import { getMemoryUsage, getHeapUsed } from '../memory-usage';

describe('memory-usage utility (ISS-006)', () => {
  it('returns a MemoryMetrics object with numeric fields', () => {
    const mem = getMemoryUsage();
    expect(mem).toHaveProperty('heapUsed');
    expect(mem).toHaveProperty('heapTotal');
    expect(typeof mem.heapUsed).toBe('number');
    expect(typeof mem.heapTotal).toBe('number');
    expect(mem.heapUsed).toBeGreaterThanOrEqual(0);
    expect(mem.heapTotal).toBeGreaterThanOrEqual(0);
  });

  it('getHeapUsed returns a number >= 0', () => {
    const used = getHeapUsed();
    expect(typeof used).toBe('number');
    expect(used).toBeGreaterThanOrEqual(0);
  });

  it('falls back gracefully when process.memoryUsage is unavailable', () => {
    const originalProcess = global.process;
    // Simulate browser-like environment where process.memoryUsage doesn't exist
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).process = undefined;
      const mem = getMemoryUsage();
      // Should still return valid structure (heapUsed may be 0 or from performance.memory)
      expect(mem.heapUsed).toBeGreaterThanOrEqual(0);
      expect(mem.heapTotal).toBeGreaterThanOrEqual(0);
    } finally {
      globalThis.process = originalProcess;
    }
  });

  it('in Node.js environment, heapUsed and heapTotal are positive', () => {
    // This test runs in Node.js so process.memoryUsage should be available
    const mem = getMemoryUsage();
    expect(mem.heapUsed).toBeGreaterThan(0);
    expect(mem.heapTotal).toBeGreaterThan(0);
    if (mem.rss !== undefined) {
      expect(mem.rss).toBeGreaterThan(0);
    }
  });
});
