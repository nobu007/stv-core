/**
 * Makes the `jest` object available as a global in ESM mode.
 *
 * When Jest runs with `--experimental-vm-modules` and `extensionsToTreatAsEsm`,
 * the `jest` global is NOT injected.  Tests that call `jest.resetModules()`,
 * `jest.restoreAllMocks()`, etc. get `ReferenceError: jest is not defined`.
 *
 * The fix recommended by Jest docs is to `import { jest } from '@jest/globals'`
 * in every file — but that imports the *module-scoped* binding which has
 * different (stricter) TypeScript types than the ambient global declared by
 * `@types/jest`, causing type regressions.
 *
 * This setup file bridges the gap: it imports the runtime object once and
 * assigns it to `globalThis` so every test file sees it as a global, matching
 * the ambient type declarations from `@types/jest`.
 *
 * Additionally, when JEST_MEMORY_LOG=1 is set, logs per-test-file heap usage
 * to stderr so individual test files with high memory consumption can be
 * identified for maxWorkers tuning.
 */
import { jest } from '@jest/globals';

globalThis.jest = jest;

// Per-test-file memory profiling (opt-in via JEST_MEMORY_LOG=1)
if (process.env.JEST_MEMORY_LOG === '1' && typeof beforeAll === 'function') {
  let heapBefore = 0;

  beforeAll(() => {
    if (globalThis.gc) {
      globalThis.gc();
    }
    heapBefore = process.memoryUsage().heapUsed;
  });

  afterAll(() => {
    if (globalThis.gc) {
      globalThis.gc();
    }
    const heapAfter = process.memoryUsage().heapUsed;
    const deltaMB = ((heapAfter - heapBefore) / 1024 / 1024).toFixed(1);
    const afterMB = (heapAfter / 1024 / 1024).toFixed(1);
    process.stderr.write(
      `[jest:mem] ${expect.getState().testPath || 'unknown'} ` +
      `heap=${afterMB}MB delta=${deltaMB}MB\n`,
    );
  });
}
