import { describe, expect, it } from '@jest/globals';

import { computePercentiles, percentileCeil, percentChange } from '@/lib/metrics-utils';

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

/**
 * Canonical single-source ceil-rank percentile lock.
 *
 * Six call sites (real-time-performance-monitor, performance-dashboard,
 * recovery-telemetry-aggregator ×2, llm-service getAdaptiveTimeout/getStats)
 * previously each inlined the ceil-rank formula. These tests lock the ONE
 * shared implementation AND prove it stays distinct from the floor-rank
 * `computePercentiles` (the two methods resolve the same sample to different
 * values and must never be merged).
 */
describe('percentileCeil (canonical single-source ceil-rank)', () => {
  it('returns 0 for an empty sample', () => {
    expect(percentileCeil([], 0.95)).toBe(0);
  });

  it('returns the single element for a one-element sample', () => {
    expect(percentileCeil([42], 0.95)).toBe(42);
    expect(percentileCeil([42], 0.5)).toBe(42);
  });

  it('locks the ceil-rank method against the divergent floor-rank helper', () => {
    // Sentinel: 20 distinct ascending values. The canonical ceil-rank method
    //   index = max(0, ceil(fraction * n) - 1)
    // resolves p50 -> sorted[9]=9, p95 -> sorted[18]=18, p99 -> sorted[19]=19.
    //
    // The structurally-similar floor-rank `computePercentiles` (index =
    // min(floor(fraction * n), n - 1)) resolves the SAME sample to
    // p50 -> sorted[10]=10 and p95 -> sorted[19]=19 — DISTINCT values for p50
    // and p95. These expected numbers fail if anyone re-points a ceil-rank
    // caller at the floor-rank helper (or vice-versa), which is exactly the
    // cross-method drift these two helpers exist to prevent.
    const sorted = Array.from({ length: 20 }, (_, i) => i); // 0..19
    expect(percentileCeil(sorted, 0.5)).toBe(9);
    expect(percentileCeil(sorted, 0.95)).toBe(18);
    expect(percentileCeil(sorted, 0.99)).toBe(19);

    // Cross-check: the floor-rank helper genuinely disagrees on p50/p95.
    expect(computePercentiles(sorted).p50).toBe(10);
    expect(computePercentiles(sorted).p95).toBe(19);
  });

  it('reproduces the real-time-performance-monitor snapshot values', () => {
    // Propagation guard: the monitor records 100 linearly-increasing response
    // times (10, 20, …, 1000). Its snapshot exposes p95/p99 derived from this
    // helper, so the canonical ceil-rank must yield the same indices the
    // monitor's own test asserts (p95 > 900, p99 > 950).
    const sorted = Array.from({ length: 100 }, (_, i) => (i + 1) * 10); // 10..1000
    // ceil(100 * 0.95) - 1 = 94 -> sorted[94] = 950
    expect(percentileCeil(sorted, 0.95)).toBe(950);
    // ceil(100 * 0.99) - 1 = 98 -> sorted[98] = 990
    expect(percentileCeil(sorted, 0.99)).toBe(990);
  });

  it('does not internally re-sort the caller-provided sample', () => {
    // Contract: the caller MUST pre-sort. A descending sample is NOT re-ordered,
    // so p95 reflects the literal (mis-ordered) index — proving no hidden
    // internal sort that would mask a caller bug.
    const descending = Array.from({ length: 20 }, (_, i) => 19 - i); // 19..0
    expect(percentileCeil(descending, 0.95)).toBe(1); // sorted[18] of the descending array
  });
});

/**
 * Canonical single-source percent-change lock.
 *
 * Four modules (regression-detector, performance-regression-detector,
 * cost-efficiency-metrics, quality-monitor) previously each inlined the
 * percent-change formula with DRIFTING denominators — one used `Math.abs`,
 * the other three used the raw baseline. These tests lock the ONE shared
 * abs-denominator implementation and pin the sentinel value that proves the
 * raw-denominator re-derivation cannot reproduce it.
 */
describe('percentChange (canonical single-source)', () => {
  it('computes the signed change for a positive baseline', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
    expect(percentChange(200, 100)).toBe(100);
  });

  it('returns 0 for a zero baseline (no division by zero)', () => {
    expect(percentChange(100, 0)).toBe(0);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(-50, 0)).toBe(0);
  });

  it('uses the abs-denominator so a negative baseline is sign-correct', () => {
    // SENTINEL — the distinctive value the raw-denominator re-derivation cannot
    // reproduce. For current = -50, baseline = -100:
    //   canonical (abs): ((-50 - -100) / |-100|) * 100 = (50 / 100) * 100 = +50
    //   raw (drifted):   ((-50 - -100) / -100)  * 100 = (50 / -100) * 100 = -50  ← sign-flipped
    // Every reachable baseline here is non-negative, so this only manifests as
    // a divergence for a signed/delta baseline — but it is exactly the drift
    // the single canonical helper exists to prevent.
    expect(percentChange(-50, -100)).toBe(50);
    expect(percentChange(0, -100)).toBe(100);
    expect(percentChange(-150, -100)).toBe(-50);
  });
});
