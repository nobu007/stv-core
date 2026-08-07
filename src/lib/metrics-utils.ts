/**
 * Shared metrics utilities — single source of truth for percentile computation.
 *
 * Previously three metrics collectors (pipeline / http / export) each carried a
 * verbatim copy of `computePercentiles`. Independent copies can silently drift
 * (different rank methods, clamps, or fractions), producing different p95/p99
 * values for identical sample sets — a latent duplicate-formula hazard.
 * Centralizing here guarantees one canonical floor-rank method across every
 * collector that derives percentiles for health / latency / cost decisions.
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
