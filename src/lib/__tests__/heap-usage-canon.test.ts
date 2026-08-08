/**
 * @jest-environment node
 */
/**
 * Heap-usage ratio — structural guard against re-derivation.
 *
 * The `heapUsed / heapTotal` division (with its `heapTotal > 0` guard) recurred
 * at THREE layers because each was fixed in isolation while the next module
 * kept re-inlining the same division:
 *   - health-check-service.ts        → memoryUsagePercent (×100)
 *   - real-time-performance-monitor  → memoryUsagePercent (×100)
 *   - enhanced-error-recovery.ts     → memoryPressure (fraction)
 * Two of the three feed the SAME `memoryUsagePercent` field consumed by
 * decision-bearing gates (health status at 70/90; `adaptive-quality-gates`
 * deployment readiness). A unit test on any one site proves nothing about the
 * others — the division always survived somewhere. This concentrates the
 * division+guard into ONE canonical function (`heapUsageRatio`, with
 * `heapUsagePercent` as its ×100 form) and STRUCTURALLY forbids re-inlining the
 * `heapUsed / heapTotal` division at any call site. The broad sweep fails loudly
 * if anyone re-inlines the division — the 4th instance of this defect class.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';

const metricsUtilsSrc = readFileSync(
  resolve(process.cwd(), 'src/lib/metrics-utils.ts'),
  'utf8',
);
const healthCheckSrc = readFileSync(
  resolve(process.cwd(), 'src/monitoring/health-check-service.ts'),
  'utf8',
);
const monitorSrc = readFileSync(
  resolve(process.cwd(), 'src/monitoring/real-time-performance-monitor.ts'),
  'utf8',
);
const errorRecoverySrc = readFileSync(
  resolve(process.cwd(), 'src/quality/enhanced-error-recovery.ts'),
  'utf8',
);

/** Strip comments (block + line) so doc references to the formula don't match. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Matches a heap-usage DIVISION: a `heapUsed` property access followed within a
 * short window by a `/` then a `heapTotal` property access — the re-derivation
 * shape (`memoryUsage.heapUsed / memoryUsage.heapTotal`). Bare parameter names
 * (`heapUsed / heapTotal` in the canonical) lack the leading `.` and don't
 * match, so the canonical definition in metrics-utils.ts is naturally exempt.
 */
const HEAP_DIVISION = /\.heapUsed\b[\s\S]{0,30}?\/[\s\S]{0,30}?\.heapTotal\b/;

describe('heapUsageRatio / heapUsagePercent — canonical heap-ratio builders', () => {
  it('metrics-utils exports both the ratio core and the percent form', () => {
    expect(metricsUtilsSrc).toMatch(/export\s+function\s+heapUsageRatio\s*\(/);
    expect(metricsUtilsSrc).toMatch(/export\s+function\s+heapUsagePercent\s*\(/);
    // The percent form delegates to the ratio core (scaling lives once).
    expect(metricsUtilsSrc).toMatch(/heapUsagePercent[\s\S]*?return\s+heapUsageRatio\s*\(/);
    // The core guards a non-positive total (the shared zero-division guard).
    expect(stripComments(metricsUtilsSrc)).toMatch(/heapUsageRatio[\s\S]*?heapTotal\s*<=\s*0/);
  });
});

describe('heap-ratio division — no re-derivation at the known call sites', () => {
  it('health-check-service delegates usagePercent to heapUsagePercent', () => {
    expect(stripComments(healthCheckSrc)).toMatch(/import\s*\{[^}]*\bheapUsagePercent\b[^}]*\}\s*from\s*['"]@\/lib\/metrics-utils['"]/);
    expect(stripComments(healthCheckSrc)).toMatch(/heapUsagePercent\s*\(\s*memoryUsage\.heapUsed\s*,\s*memoryUsage\.heapTotal\s*\)/);
    expect(stripComments(healthCheckSrc)).not.toMatch(HEAP_DIVISION);
  });

  it('real-time-performance-monitor delegates memoryUsagePercent to heapUsagePercent', () => {
    expect(stripComments(monitorSrc)).toMatch(/import\s*\{[^}]*\bheapUsagePercent\b[^}]*\}\s*from\s*['"]@\/lib\/metrics-utils['"]/);
    expect(stripComments(monitorSrc)).toMatch(/heapUsagePercent\s*\(\s*memoryUsage\.heapUsed\s*,\s*memoryUsage\.heapTotal\s*\)/);
    expect(stripComments(monitorSrc)).not.toMatch(HEAP_DIVISION);
  });

  it('enhanced-error-recovery delegates memoryPressure to heapUsageRatio (fraction, not percent)', () => {
    expect(stripComments(errorRecoverySrc)).toMatch(/import\s*\{[^}]*\bheapUsageRatio\b[^}]*\}\s*from\s*['"]@\/lib\/metrics-utils['"]/);
    expect(stripComments(errorRecoverySrc)).toMatch(/memoryPressure:\s*heapUsageRatio\s*\(/);
    expect(stripComments(errorRecoverySrc)).not.toMatch(HEAP_DIVISION);
  });
});

describe('heap-ratio division — broad cross-layer sweep', () => {
  // Belt-and-suspenders: no production file anywhere under src/ may re-inline the
  // `heapUsed / heapTotal` division. Catches a future site in any dir, not just
  // the three known publishers. The canonical definition in metrics-utils.ts is
  // excluded (it is the ONE sanctioned division).
  it('no production source file re-derives heapUsed / heapTotal', () => {
    const files = (globSync('src/**/*.ts') as string[]).filter(
      f => !f.includes('__tests__') && !f.endsWith('metrics-utils.ts'),
    );

    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(resolve(process.cwd(), file), 'utf8'));
      if (HEAP_DIVISION.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
