/**
 * Shared metrics utilities — single source of truth for percentile and
 * percent-change computation.
 *
 * Previously three metrics collectors (pipeline / http / export) each carried a
 * verbatim copy of `computePercentiles`. Independent copies can silently drift
 * (different rank methods, clamps, or fractions), producing different p95/p99
 * values for identical sample sets — a latent duplicate-formula hazard.
 * Centralizing here guarantees one canonical floor-rank method across every
 * collector that derives percentiles for health / latency / cost decisions.
 * The same hazard applied to the percent-change formula (`percentChange` below),
 * re-derived with drifting denominators across four regression/cost modules.
 */

/** p50 / p95 / p99 percentile triple over a ranked sample. */
export interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Compute p50 / p95 / p99 from an ASCENDING-sorted sample using the floor-rank
 * method: `index = min(floor(fraction * n), n - 1)`. Returns all zeros when the
 * sample is empty.
 *
 * @param sorted non-decreasing sample values — the caller MUST sort first.
 */
export function computePercentiles(sorted: number[]): Percentiles {
  if (sorted.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const p = (rank: number) => sorted[Math.min(Math.floor(rank), sorted.length - 1)];
  return {
    p50: p(sorted.length * 0.5),
    p95: p(sorted.length * 0.95),
    p99: p(sorted.length * 0.99),
  };
}

/**
 * Compute a SINGLE percentile from an ASCENDING-sorted sample using the
 * ceil-rank method: `index = max(0, ceil(fraction * n) - 1)`. Returns 0 when
 * the sample is empty.
 *
 * This is the canonical ceil-rank counterpart to the floor-rank
 * {@link computePercentiles} triple. BOTH rank methods live in this codebase
 * deliberately: ceil-rank and floor-rank resolve the SAME sample to DISTINCT
 * values, so they must never be merged. Keep them separate.
 *
 * Why this exists: the ceil-rank formula was previously inlined — verbatim —
 * across six call sites (real-time-performance-monitor, performance-dashboard,
 * recovery-telemetry-aggregator ×2, llm-service `getAdaptiveTimeout` and
 * `getStats`). Each independent copy can silently drift (dropping the `- 1`,
 * the `max(0, …)` clamp, or the `|| 0` fallback), and these percentiles feed
 * live decisions: the memory healthy/degraded/unhealthy status, the
 * deployment-readiness gate (`adaptive-quality-gates`), and the LLM adaptive
 * request-timeout gate (`getAdaptiveTimeout`). One canonical implementation
 * guarantees identical ceil-rank output everywhere.
 *
 * NOT for the floor-rank percentiles in `production-monitor` or the floor-rank
 * p50 median in `llm-service.getStats` — those are a different method by design.
 *
 * @param sorted non-decreasing sample values — the caller MUST sort first.
 * @param fraction desired percentile as a fraction in (0, 1] (e.g. 0.95).
 */
export function percentileCeil(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

/**
 * Signed percentage change of `current` relative to `baseline`, using the
 * canonical formula `((current - baseline) / |baseline|) * 100`. Returns 0
 * when the baseline is 0 (no meaningful percentage can be computed without a
 * division by zero).
 *
 * Why this exists: the percent-change formula was previously inlined — with
 * subtly DRIFTING denominators — across four modules that each feed
 * decision-bearing gates:
 * - `regression-detector.ts` used `Math.abs(baseline)` (sign-correct for any
 *   baseline sign);
 * - `performance-regression-detector.ts`, `cost-efficiency-metrics.ts`, and
 *   `quality-monitor.ts` used the RAW `baseline` (sign-flips the result for a
 *   negative baseline, e.g. `(-50 - -100) / -100 = -50` instead of `+50`).
 *
 * Every reachable baseline here is non-negative (timings, costs, F1, accuracy),
 * so the two forms agree today — but a single canonical abs-denominator makes
 * the helper correct even if a future caller feeds a signed/delta baseline,
 * and guarantees one definition rather than four drifting copies.
 *
 * Callers keep their own control flow (zero-baseline skip / safe-default /
 * `> 0` guard); only the arithmetic delegates here.
 *
 * @param current  the new measurement value.
 * @param baseline the reference value to compare against.
 * @returns signed percent change, or 0 when `baseline === 0`.
 */
export function percentChange(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}
