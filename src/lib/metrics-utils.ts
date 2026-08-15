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
 * re-derived with drifting denominators across four regression/cost modules,
 * and to the decimal-rounding formula (`roundTo` below), inlined in three
 * precision tiers (`*10`/`*100`/`*1000`) across ~30 metric-publishing sites.
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
  // Non-finite baseline → no meaningful percentage (returns 0, NOT NaN). A
  // poisoned/tampered baseline whose magnitude is `1e400` survives JSON.parse
  // as Infinity (the exact vector `regression-detector.loadBaseline`'s guard
  // closes at the LOAD site) and otherwise reaches this canonical formula,
  // yielding NaN: `((current - Infinity) / |Infinity|) * 100` → NaN. Every NaN
  // comparison at the four consumers (`>= threshold`, `> 0`, `< 0`) is then
  // false, so the metric is silently classified "stable" and the
  // regression/cost/performance gate is disabled with no warning — the hazard
  // session-60 documented. That load-site guard closed ONE vector; this SINK
  // guard closes the canonical formula itself so ALL consumers (current +
  // future) are structurally protected, mirroring the `baseline === 0 → 0`
  // "no meaningful percentage" precedent. `current` is intentionally left
  // unguarded: a non-finite MEASUREMENT legitimately signals a large change.
  if (!Number.isFinite(baseline)) return 0;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

/**
 * Round `value` to `decimals` fractional digits using the canonical
 * `Math.round(value * 10^decimals) / 10^decimals` formula.
 *
 * Why this exists: decimal rounding was previously inlined — verbatim, in THREE
 * precision tiers (`*10)/10`, `*100)/100`, `*1000)/1000`) — across ~30 call sites
 * spanning every monitoring/quality/analysis/export layer (hitRate, successRate,
 * errorRate, cacheHitRate, recoveryRate, heapUsedMB, usagePercent, changePercent,
 * improvementPercent, …). Independent copies of the SAME arithmetic invite the
 * precision to drift: a `*1000` site silently degrading to `*100` rounds a 3-dp
 * metric to 2 dp and is invisible at the call site. The three tiers are one
 * defect class — retiring only the 3-dp tier while the 1-dp/2-dp siblings survive
 * is exactly the recurrence this module exists to short-circuit (see
 * `computePercentiles` / `percentChange` above for the same hazard). One
 * parameterized function retires all three tiers at once and guarantees
 * identical rounding everywhere a metric is published.
 *
 * Behavior-preserving: this uses the SAME arithmetic the inlined sites used (no
 * `Number.EPSILON` correction), so output is byte-identical to the previous
 * per-site rounding — this is a deduplication, not a behavior change. Callers
 * that need a DISPLAY string must use `.toFixed(decimals)`; this helper returns a
 * rounded NUMBER.
 *
 * @param value    the number to round.
 * @param decimals number of fractional digits to keep (e.g. `3` → 3 dp).
 * @returns `value` rounded to `decimals` places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Heap-usage RATIO: `heapUsed / heapTotal`, guarded against a non-positive
 * total. Returns 0 when `heapTotal <= 0` (a runtime that exposes no memory API
 * reports `heapTotal: 0`, and the ratio is undefined at 0). `heapUsed` may
 * exceed `heapTotal` under GC pressure, so the result is unclamped above 1.
 *
 * Why this exists: the `heapUsed / heapTotal` division (with its
 * `heapTotal > 0` guard) was previously inlined — verbatim, with the SAME guard
 * — in three modules:
 * - `monitoring/health-check-service.ts`        — published as `memoryUsagePercent` (×100)
 * - `monitoring/real-time-performance-monitor.ts` — published as `memoryUsagePercent` (×100)
 * - `quality/enhanced-error-recovery.ts`         — published as `memoryPressure` (fraction)
 *
 * All three derive from the identical division+guard, but two of them feed the
 * SAME `memoryUsagePercent` field consumed by decision-bearing gates (the
 * healthy/degraded/unhealthy status at the 70/90 thresholds and the
 * `adaptive-quality-gates` deployment-readiness gate), and the third feeds the
 * recovery load-metrics `memoryPressure`. Three independent copies of the
 * division can silently drift — e.g. one dropping the zero-guard and emitting
 * `NaN` when `heapTotal` is 0, or switching the guard to `>=` — and the
 * published fields would then disagree about identical memory. One canonical
 * ratio guarantees the division+guard is identical everywhere; `heapUsagePercent`
 * below is its ×100 form so percent callers don't re-inline the scaling either.
 *
 * Callers keep their own control flow (status thresholds, rounding); only the
 * ratio delegates here.
 *
 * @param heapUsed  used heap in bytes.
 * @param heapTotal total heap in bytes.
 * @returns `heapUsed / heapTotal`, or 0 when `heapTotal <= 0`.
 */
export function heapUsageRatio(heapUsed: number, heapTotal: number): number {
  if (heapTotal <= 0) return 0;
  return heapUsed / heapTotal;
}

/**
 * Heap-usage PERCENTAGE: {@link heapUsageRatio} scaled to 0-100. Returns 0 when
 * `heapTotal <= 0`. The ×100 scaling lives here so the two `memoryUsagePercent`
 * publishers never re-inline the scaling alongside the division. See
 * {@link heapUsageRatio} for the canonical division+guard.
 */
export function heapUsagePercent(heapUsed: number, heapTotal: number): number {
  return heapUsageRatio(heapUsed, heapTotal) * 100;
}

/**
 * Sum of the finite elements of `values` (`Number.isFinite` per element).
 * Returns `fallback` (default 0) when no finite element exists — including
 * the empty array. Single pass, O(n), never throws.
 *
 * Non-finite elements are EXCLUDED, not zero-substituted (specs/
 * finite-safe-aggregation architecture D2): for aggregates over observations,
 * a missing sample leaves the population — zero-substitution would bias e.g.
 * a mean of `[100, 200, NaN]` down to 100 instead of the correct 150.
 * Zero-substitution of a SCALAR field remains `sanitizeFinite`'s job
 * (`src/utils/guards.ts`); the two coexist by scope, scalar vs aggregate.
 *
 * Finite-only inputs are bitwise-equal to `values.reduce((a, b) => a + b, 0)`:
 * the same additions happen in the same order starting from 0, so `-0`
 * propagates identically (`0 + -0 = +0`, as in the legacy reduce).
 */
export function safeSum(values: readonly number[], fallback: number = 0): number {
  let acc = 0;
  let any = false;
  for (const v of values) {
    if (Number.isFinite(v)) {
      acc += v;
      any = true;
    }
  }
  return any ? acc : fallback;
}

/**
 * Arithmetic mean of the finite elements of `values`, with the denominator
 * being the FINITE-element count — NOT the array length. Dividing by the
 * array length after exclusion would discount the mean once per excluded
 * element (the zero-substitution bias D2 rejects). Returns `fallback`
 * (default 0) when no finite element exists. Never throws, never returns
 * `NaN` (an empty fold never reaches the division).
 *
 * Finite-only inputs are bitwise-equal to
 * `values.reduce((a, b) => a + b, 0) / values.length` — the same two
 * operations in the same order.
 */
export function safeMean(values: readonly number[], fallback: number = 0): number {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count > 0 ? sum / count : fallback;
}

/**
 * Maximum of the finite elements of `values`. Returns `fallback` (default 0)
 * when no finite element exists — it never returns `-Infinity` (the legacy
 * `Math.max(...values)` on an empty or all-`-Infinity` array) and never
 * propagates a `NaN` element. Loop-based, so unlike the spread form it
 * cannot blow the call stack on large arrays (EDGE-102: `Math.max(...arr)`
 * throws RangeError from ~1e5 elements).
 *
 * Finite-only non-empty inputs are value-equal to `Math.max(...values)`
 * (max is order-insensitive, so bitwise equality of doubles holds trivially).
 */
export function safeMax(values: readonly number[], fallback: number = 0): number {
  let acc: number | null = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    // `v > acc || both-zero-with-v-positive` mirrors Math.max's zero-sign
    // rule: max(-0, +0) is +0, and max of all -0 stays -0.
    if (acc === null || v > acc || (v === 0 && acc === 0 && Object.is(v, 0))) {
      acc = v;
    }
  }
  return acc === null ? fallback : acc;
}

/**
 * Minimum of the finite elements of `values` — the mirror of
 * {@link safeMax}: returns `fallback` (default 0) when no finite element
 * exists, never `+Infinity`, never NaN, loop-based (no spread).
 */
export function safeMin(values: readonly number[], fallback: number = 0): number {
  let acc: number | null = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    // `v < acc || both-zero-with-v-negative` mirrors Math.min's zero-sign
    // rule: min(+0, -0) is -0, and min of all +0 stays +0.
    if (acc === null || v < acc || (v === 0 && acc === 0 && Object.is(v, -0))) {
      acc = v;
    }
  }
  return acc === null ? fallback : acc;
}

/**
 * Convert a byte count to binary megabytes (MiB): `bytes / (1024 * 1024)`.
 *
 * The `bytes / 1024 / 1024` conversion recurred at 20+ sites across the heap
 * metric family and the file-/memory-size display layer. R3 centralized the
 * heap-usage RATIO (`heapUsageRatio`/`heapUsagePercent`) but left the raw MB
 * conversion re-derived inline beside it — e.g. `health-check-service` and
 * `real-time-performance-monitor` compute `heapUsedMB`/`heapTotalMB` by hand in
 * the SAME block that already delegates the ratio. Concentrating the conversion
 * here guarantees the "1 MB = 1024² bytes" definition lives in exactly one
 * place; a future site that silently switches to decimal megabytes
 * (`/ 1000 / 1000`) — or a typo'd single `/ 1024` — can no longer drift past a
 * reader who assumes every MB in the system agrees.
 *
 * This is bit-identical to the inline form: dividing by 1024 is an exact IEEE-754
 * exponent shift, so `bytes / 1024 / 1024` and `bytes / (1024 * 1024)` produce the
 * same double for every finite input. Output rounding stays at the call site
 * (callers compose `roundTo(bytesToMb(x), 2)`), so this never changes a published
 * value.
 *
 * @param bytes  a size in bytes (heap/rss/external, file size, etc.).
 * @returns `bytes / (1024 * 1024)` — the size in binary megabytes.
 */
export function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024);
}
