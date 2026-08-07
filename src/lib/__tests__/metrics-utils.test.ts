import { describe, expect, it } from '@jest/globals';

import { computePercentiles } from '@/lib/metrics-utils';

/**
 * Canonical single-source percentile behavior lock.
 *
 * Three metrics collectors (pipeline / http / export) previously each carried a
 * verbatim copy of `computePercentiles`. These tests lock the ONE shared
 * implementation so any re-introduced local copy that diverges (different rank
 * method or fraction) fails loudly here and at the collector level.
 */
describe('computePercentiles (canonical single-source)', () => {
  it('returns zeros for an empty sample', () => {
    expect(computePercentiles([])).toEqual({ p50: 0, p95: 0, p99: 0 });
  });

  it('clamps every percentile to the single element for a one-element sample', () => {
    expect(computePercentiles([42])).toEqual({ p50: 42, p95: 42, p99: 42 });
  });

  it('locks the floor-rank method against the divergent ceil-rank sibling', () => {
    // Sentinel: 20 distinct ascending values. The canonical floor-rank method
    //   index = min(floor(fraction * n), n - 1)
    // resolves p50 -> sorted[10]=10, p95 -> sorted[19]=19, p99 -> sorted[19]=19.
    //
    // The structurally-similar ceil-rank method used by sibling modules
    // (index = ceil(fraction * n) - 1, e.g. src/analysis/llm-service.ts,
    // src/quality/recovery-telemetry-aggregator.ts) would instead resolve
    // p50 -> sorted[9]=9 and p95 -> sorted[18]=18 — a DISTINCT, wrong value for
    // this canonical source. These expected numbers fail if anyone re-introduces
    // that method here, which is exactly the duplicate-formula drift we prevent.
    const sorted = Array.from({ length: 20 }, (_, i) => i); // 0..19
    expect(computePercentiles(sorted)).toEqual({ p50: 10, p95: 19, p99: 19 });
  });

  it('does not internally re-sort the caller-provided sample', () => {
    // Documented contract: the caller MUST pre-sort. A descending sample is NOT
    // re-ordered, so p95 reflects the literal (mis-ordered) index — proving no
    // hidden internal sort that would mask a caller bug.
    const descending = Array.from({ length: 20 }, (_, i) => 19 - i); // 19..0
    expect(computePercentiles(descending).p95).toBe(0);
  });

  it('produces monotonic p50 <= p95 <= p99 for a varied sample', () => {
    const sorted = [3, 3, 5, 7, 8, 10, 12, 15, 20, 21, 25, 30, 33, 40, 50, 60, 70, 80, 95, 100];
    const { p50, p95, p99 } = computePercentiles(sorted);
    expect(p50).toBeLessThanOrEqual(p95);
    expect(p95).toBeLessThanOrEqual(p99);
    // Every value must come from the sample set.
    expect(sorted).toContain(p50);
    expect(sorted).toContain(p95);
    expect(sorted).toContain(p99);
  });
});
