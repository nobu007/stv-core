import { describe, expect, it } from '@jest/globals';

import { computePercentiles, percentileCeil, percentChange, roundTo, heapUsageRatio, heapUsagePercent } from '@/lib/metrics-utils';

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

  it('returns 0 (not NaN) for a non-finite baseline — closes the session-60 NaN vector at the sink', () => {
    // A poisoned/tampered baseline whose magnitude is `1e400` survives
    // JSON.parse as Infinity (the exact vector regression-detector's loadBaseline
    // guard closes at the LOAD site). Reaching this canonical formula it yields
    // NaN: `((100 - Infinity) / |Infinity|) * 100` → `(-Infinity / Infinity) * 100`
    // → NaN. Every NaN comparison at the four consumers (`>= threshold`, `> 0`,
    // `< 0`) is false, so the metric is silently classified "stable" and the
    // regression/cost/performance gate is disabled with no warning — the hazard
    // session-60 documented. That load-site guard closed ONE vector; this sink
    // guard closes the canonical formula itself so ALL consumers (current +
    // future) are structurally protected, mirroring the zero-baseline "no
    // meaningful percentage" precedent above. Current is intentionally left
    // unguarded: a non-finite MEASUREMENT legitimately signals a large change.
    expect(percentChange(100, Infinity)).toBe(0);
    expect(percentChange(100, -Infinity)).toBe(0);
    expect(percentChange(50, Infinity)).toBe(0);
    // Sentinel: a non-finite baseline must NOT leak NaN downstream.
    expect(Number.isNaN(percentChange(100, Infinity))).toBe(false);
    // A non-finite CURRENT against a finite baseline still flags (preserved).
    expect(percentChange(Infinity, 100)).toBe(Infinity);
  });
});

/**
 * Canonical single-source decimal-rounding lock.
 *
 * ~30 call sites across every monitoring/quality/analysis/export layer previously
 * inlined `Math.round(x * 10^d) / 10^d` in THREE precision tiers (1/2/3 dp). These
 * tests lock the ONE parameterized implementation: it must (a) reproduce the
 * exact arithmetic the inlined sites used (byte-identical, so deduplication is
 * behavior-preserving), and (b) collapse all three tiers — a future caller
 * passing the wrong `decimals` is a single-arg mistake, not a drifted copy.
 */
describe('roundTo (canonical single-source decimal rounding)', () => {
  it('rounds to the requested precision for each tier', () => {
    // Tiers actually used in production: 1 dp (llm rates), 2 dp (memory/percent),
    // 3 dp (hit/success/error rates).
    expect(roundTo(0.66666, 1)).toBe(0.7);
    expect(roundTo(0.66666, 2)).toBe(0.67);
    expect(roundTo(0.66666, 3)).toBe(0.667);
    expect(roundTo(123.4567, 3)).toBe(123.457);
    expect(roundTo(123.4567, 2)).toBe(123.46);
  });

  it('is byte-identical to the inlined Math.round(x*10^d)/10^d it replaces', () => {
    // Behavior-preservation property: for the value/precision pairs the inlined
    // sites handled, the helper MUST equal the old inline formula exactly — this
    // is a deduplication, not a rounding-method change. Drives many values across
    // all three tiers so a hidden divergence (e.g. an added EPSILON correction)
    // surfaces.
    const cases: Array<[number, number]> = [
      [0.837261, 3], [0.5, 3], [0.123999, 3], [0.0005, 3], [12.34567, 3],
      [78.4219, 2], [0.99, 2], [156.789, 2], [0.004, 2], [33.0, 2],
      [0.85, 1], [3.14159, 1], [99.95, 1], [0.06, 1], [7.0, 1],
    ];
    for (const [value, decimals] of cases) {
      const factor = 10 ** decimals;
      const inline = Math.round(value * factor) / factor;
      expect(roundTo(value, decimals)).toBe(inline);
    }
  });

  it('treats decimals=0 as round-to-integer (factor 1)', () => {
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(2.4, 0)).toBe(2);
    expect(roundTo(123.999, 0)).toBe(124);
  });

  it('handles the rounded metric values published across layers', () => {
    // Sentinel cases drawn from real call sites: successRate ~0.9971 -> 3 dp,
    // heapUsedMB ~42.37 -> 2 dp, improvementPercent ~12.3 -> 1 dp. Pins the
    // contract the monitoring/quality dashboards depend on.
    expect(roundTo(0.99713, 3)).toBe(0.997);
    expect(roundTo(42.367, 2)).toBe(42.37);
    expect(roundTo(12.34, 1)).toBe(12.3);
  });
});

/**
 * Canonical single-source heap-usage ratio/percent lock.
 *
 * Three modules (health-check-service, real-time-performance-monitor,
 * enhanced-error-recovery) previously each inlined the `heapUsed / heapTotal`
 * division with its `heapTotal > 0` guard — two of them publishing the SAME
 * `memoryUsagePercent` field (×100) consumed by decision-bearing gates. These
 * tests lock the ONE shared division+guard and prove percent == ratio × 100, so
 * any re-introduced local copy that diverges (dropping the guard, or swapping
 * the percent/fraction scaling) fails loudly here and at the call site.
 */
describe('heapUsageRatio / heapUsagePercent (canonical single-source heap ratio)', () => {
  it('computes the ratio and percent for a normal heap', () => {
    // 75 MiB used of 100 MiB -> 0.75 ratio, 75% percent.
    expect(heapUsageRatio(75 * 1024 * 1024, 100 * 1024 * 1024)).toBeCloseTo(0.75, 10);
    expect(heapUsagePercent(75 * 1024 * 1024, 100 * 1024 * 1024)).toBeCloseTo(75, 10);
  });

  it('returns 0 when heapTotal is 0 (no division by zero, runtime exposes no API)', () => {
    // SENTINEL — the distinctive value the un-guarded re-derivation cannot
    // reproduce. Without the guard `heapUsed / 0` yields `Infinity`, and
    // `* 100` then yields `Infinity`; the gate `memoryUsagePercent > 85` would
    // flip to unhealthy/degraded spuriously. The guard returns 0 instead.
    expect(heapUsageRatio(42, 0)).toBe(0);
    expect(heapUsagePercent(42, 0)).toBe(0);
    expect(heapUsageRatio(0, 0)).toBe(0);
    expect(heapUsagePercent(0, 0)).toBe(0);
  });

  it('returns 0 for a non-positive total (guard mirrors the original `heapTotal > 0`)', () => {
    expect(heapUsageRatio(42, -100)).toBe(0);
    expect(heapUsagePercent(42, -100)).toBe(0);
  });

  it('does not clamp above 1 — heapUsed can exceed heapTotal under GC pressure', () => {
    // Both original percent publishers left the result unclamped; preserve that
    // (a clamp would silently change the 70/90 health thresholds' behavior).
    expect(heapUsageRatio(150, 100)).toBe(1.5);
    expect(heapUsagePercent(150, 100)).toBe(150);
  });

  it('percent is exactly ratio × 100 (scaling lives in exactly one place)', () => {
    // Behavior-preservation property: the ×100 form MUST equal the ratio form
    // scaled by 100 for every input — this is what lets the two `memoryUsagePercent`
    // publishers delegate to `heapUsagePercent` instead of re-inlining the scaling.
    const cases: Array<[number, number]> = [
      [0, 0], [42, 0], [50, 200], [200, 100], [1, 3], [0, 99],
    ];
    for (const [used, total] of cases) {
      expect(heapUsagePercent(used, total)).toBeCloseTo(heapUsageRatio(used, total) * 100, 10);
    }
  });
});
