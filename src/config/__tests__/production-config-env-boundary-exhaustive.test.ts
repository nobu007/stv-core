/**
 * @jest-environment node
 */
/**
 * REQ-056 — closed-set anchor for the production-config env-var → configOverrides
 * numeric-injection boundary (boundary-consistency family).
 *
 * WHY THIS EXISTS
 * --------------
 * `configOverrides` (the persisted overlay reloaded by `loadConfigOverrides` and
 * merged into every `getConfig()` result) is fed by TWO independent boundaries:
 *
 *   (1) localStorage restore — guarded by `validateConfigOverrides`, which runs
 *       every persisted numeric through `isPositiveFiniteNumber` (REQ-054) and
 *       every persisted enum through the `PROD_CONFIG_ENUM_FIELDS` roster
 *       (REQ-055).
 *   (2) env-var injection — a `try` block inside `loadConfigOverrides` that
 *       parses operator-supplied env vars (`REACT_APP_*`) and assigns them into
 *       `configOverrides`.
 *
 * For most of this object's life, boundary (2) used a raw `parseInt` for its one
 * numeric override (`REACT_APP_MAX_CONCURRENT_JOBS`). `parseInt('abc')` → NaN,
 * `parseInt('-5')` → -5, `parseInt('0')` → 0 all crossed the boundary into
 * `getConfig()` / `getOptimizedConfig()` (`Math.min(NaN, n) === NaN`) UNguarded
 * — a boundary-consistency gap where one boundary enforced the magnitude
 * invariant and the other did not. REQ-056 routes that parse through the SAME
 * `isPositiveFiniteNumber` predicate so both boundaries agree; an invalid env
 * var is skipped (falls back to the env default), mirroring localStorage-
 * corruption handling.
 *
 * The per-instance tests in `production-config.test.ts` prove NaN / -5 / 0 are
 * no longer injected, but they do NOT fail when a SECOND numeric env-var
 * override is added to `loadConfigOverrides` without a matching
 * `isPositiveFiniteNumber` guard: the new field compiles, injects a non-finite
 * magnitude, and the bug ships exactly the way the first one did. This file
 * closes that gap with a source-anchored set invariant read straight from the
 * `loadConfigOverrides` body:
 *
 *   the number of `parseInt` numeric parses in the env-var injection region
 *   MUST be <= the number of `isPositiveFiniteNumber` guards in the same
 *   region (every env-var-derived numeric written into configOverrides is
 *   gated by the chokepoint).
 *
 * Both counts are read straight from source, so — unlike a hand-maintained
 * checklist — the anchor cannot drift: when a second env-var numeric is added
 * without a guard, this pin fires. The matching RED→GREEN behaviour tests live
 * in `production-config.test.ts` ("env var override finiteness").
 *
 * RED VERIFICATION
 * ----------------
 * Reverting the guard (deleting the `if (isPositiveFiniteNumber(parsed))`
 * wrapper but keeping the `parseInt`) drops the guard count to 0 while the
 * parse count stays 1 → 0 < 1 → the equality pin goes RED.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_FILE = path.resolve(__dirname, '../production-config.ts');

function readSource(): string {
  return fs.readFileSync(SOURCE_FILE, 'utf-8');
}

/**
 * The body of `loadConfigOverrides` — the only method that injects env-var
 * values into `configOverrides`. Scoped from its declaration to the next public
 * method (`getConfig`) so the (many) `isPositiveFiniteNumber` calls inside
 * `validateConfigOverrides` cannot inflate the guard count, and so unrelated
 * `parseInt` uses elsewhere cannot inflate the parse count.
 */
function readLoadConfigBody(): string {
  const src = readSource();
  const start = src.indexOf('private loadConfigOverrides');
  const end = src.indexOf('getConfig(): ProductionEnvironment', start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('loadConfigOverrides method region not found in production-config.ts');
  }
  return src.slice(start, end);
}

function countOccurrences(haystack: string, needle: string): number {
  return (haystack.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

describe('REQ-056: every env-var numeric injection into configOverrides is finiteness-guarded (boundary closed-set anchor)', () => {
  const body = readLoadConfigBody();
  const parses = countOccurrences(body, 'parseInt(');
  const guards = countOccurrences(body, 'isPositiveFiniteNumber(');

  it('loadConfigOverrides region is wired to real source (non-empty, has env-var access)', () => {
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain('getEnvVar');
  });

  it('every env-var numeric parse (parseInt) is gated by isPositiveFiniteNumber', () => {
    // guards >= parses: each numeric parse from an env var must have a
    // matching chokepoint guard. Equality today (1 == 1); >= stays correct if
    // a guard is later factored to cover several parses.
    expect(guards).toBeGreaterThanOrEqual(parses);
  });

  it('there are no unguarded numeric parses (guard deficit = 0)', () => {
    expect(parses - guards).toBeLessThanOrEqual(0);
  });
});
