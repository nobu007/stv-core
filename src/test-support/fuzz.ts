/**
 * Shared scaffolding for property-based / fuzz tests.
 *
 * These helpers were previously copy-pasted — with cosmetic variation — across
 * 14+ fuzz files. `mulberry32` alone had three surface-different but
 * mathematically-identical implementations (unsigned-accumulator `>>> 0`,
 * signed-accumulator `| 0`, and a compact inline form). All three produce the
 * exact same uint32 sequence for a given seed, because every step after the
 * accumulator update is a bitwise op that depends only on the 32-bit pattern
 * (not on whether the accumulator is stored as a signed or unsigned JS number).
 * Consolidating here halts the drift and gives every fuzz test a single source
 * of truth for determinism.
 *
 * Import as:
 *   import { mulberry32, pick, degenerateNumbers } from './fuzz';
 *
 * Vendored from speech-to-visuals tests/helpers/fuzz.ts at the stv-core split
 * (2026-08-18): the parent repo keeps its own copy for its remaining fuzz
 * suites; this copy is the single source inside stv-core.
 */

/**
 * Deterministic PRNG (mulberry32) for reproducible fuzz runs.
 *
 * Seed-stable: the same seed always yields the same sequence, so a failing
 * fuzz iteration can be reproduced exactly. No Date / Math.random dependency.
 *
 * @returns a function producing floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a deterministic random element from a (readonly) array using `rng`.
 *
 * @param arr  source array
 * @param rng  a mulberry32 (or compatible [0,1) generator)
 */
export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Battery of degenerate / edge-case numeric values for numeric fuzz tests.
 *
 * Covers NaN, ±Infinity, ±0, subnormals, MAX/MIN (safe and value), and
 * large-magnitude exponents. Useful for verifying guards never propagate
 * non-finite or absurd values downstream.
 */
export function degenerateNumbers(): number[] {
  return [
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_VALUE,
    Number.MIN_VALUE,
    -Number.MAX_VALUE,
    0,
    -0,
    Number.EPSILON,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    -(2 ** 53),
    2 ** 53,
    1e308,
    -1e308,
    1e-308,
    -1e-308,
    0.1,
    -0.1,
    1234.5678,
    -1234.5678,
  ];
}

// ---------------------------------------------------------------------------
// CSV formula-injection fuzz fixtures
//
// Shared by the CSV security fuzz tests (csv-crlf-in-quote-fuzz,
// csv-sanitizer). `CSV_FORMULA_TRIGGERS` mirrors the production
// FORMULA_PREFIXES set in src/export/csv-sanitizer.ts so the fuzz vectors
// stay in lock-step with what the sanitizer actually treats as dangerous.
// ---------------------------------------------------------------------------

/** Leading characters that trigger spreadsheet formula evaluation. */
export const CSV_FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'] as const;

/** Newline variants that can split or confuse CSV record parsing. */
export const CSV_NEWLINES = ['\n', '\r\n', '\r'] as const;

/** Characters known to be safe inside a CSV cell (no formula/quote/delimiter). */
export const CSV_SAFE_CHARS = 'ABCDEFGHabcdefgh0123456789 .';
