/**
 * @jest-environment node
 */
/**
 * bytes→MB conversion — structural guard against re-derivation.
 *
 * The `bytes / 1024 / 1024` (binary-megabyte) conversion recurred at 20+ sites
 * across two layers, each fixed in isolation while the next module kept
 * re-inlining the same division:
 *   - heap metric family (R3): health-check-service.ts & real-time-performance-monitor.ts
 *     computed heapUsedMB/heapTotalMB/rss/external by hand in the SAME block that
 *     already delegates heapUsagePercent — R3 centralized the RATIO but left the
 *     raw MB division inline beside it.
 *   - file/memory-size display: ~14 component + util + config + pipeline + export
 *     sites formatted a byte count as "N.NNMB" by re-dividing inline.
 *
 * A unit test on any one site proves nothing about the others: the conversion
 * always survived somewhere. This concentrates the "1 MB = 1024² bytes"
 * definition into ONE canonical function (`bytesToMb`) and STRUCTURALLY forbids
 * re-inlining the division at any call site. The broad sweep fails loudly if
 * anyone re-inlines `/ 1024 / 1024` (or the equivalent `/ 1048576`) anywhere
 * under src/ — the next instance of this defect class. A future site that
 * silently switches to decimal megabytes (`/ 1000 / 1000`), or a typo'd single
 * `/ 1024`, can no longer drift past a reader who assumes every MB agrees.
 *
 * The canonical is bit-identical to the inline form (dividing by 1024 is an exact
 * IEEE-754 exponent shift), so centralization changes no published value.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

import { bytesToMb } from '../metrics-utils';

// Anchored to import.meta.url, not process.cwd(): a jest worker's cwd can be
// moved by a module-load side effect (whisper-node chdir — see
// tests/__mocks__/whisper-node.ts) or simply differ under --maxWorkers>1
// (TC-302/313); cwd-relative source reads then flake with ENOENT.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const metricsUtilsSrc = readFileSync(
  resolve(REPO_ROOT, 'src/lib/metrics-utils.ts'),
  'utf8',
);
const healthCheckSrc = readFileSync(
  resolve(REPO_ROOT, 'src/monitoring/health-check-service.ts'),
  'utf8',
);
const monitorSrc = readFileSync(
  resolve(REPO_ROOT, 'src/monitoring/real-time-performance-monitor.ts'),
  'utf8',
);

/** Strip comments (block + line) so doc references to the old formula don't match. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Matches the inline bytes→MB DIVISION: a `/` then `1024` then `/` then `1024`
 * — the re-derivation shape (`heapUsed / 1024 / 1024`). Tolerates zero-or-more
 * whitespace around each `/` so `/1024/1024` and `/ 1024 / 1024` both match.
 * The canonical definition `bytes / (1024 * 1024)` has a SINGLE `/` (followed by
 * a parenthesised product), so it never matches and is naturally exempt.
 */
const BYTES_DIVISION = /\/\s*1024\s*\/\s*1024/;
/** The single-literal equivalent: `/ 1048576`. Same exemption for the canonical. */
const BYTES_LITERAL = /\/\s*1048576\b/;

describe('bytesToMb — canonical binary-megabyte builder', () => {
  it('metrics-utils exports bytesToMb and does not itself inline the division', () => {
    expect(metricsUtilsSrc).toMatch(/export\s+function\s+bytesToMb\s*\(/);
    // The canonical body must use the parenthesised product (single division),
    // never the inline `/ 1024 / 1024` / `/ 1048576` shapes the guard forbids.
    const body = stripComments(metricsUtilsSrc)
      .match(/function\s+bytesToMb\s*\([^)]*\)\s*:[^{]*\{[\s\S]*?\}/);
    expect(body).not.toBeNull();
    expect(body![0]).not.toMatch(BYTES_DIVISION);
    expect(body![0]).not.toMatch(BYTES_LITERAL);
  });

  it('returns binary megabytes: 1 MiB === 1048576 bytes, exact at powers of two', () => {
    // Runtime anchors: the conversion is the exact division the inline sites used.
    expect(bytesToMb(1024 * 1024)).toBe(1);
    expect(bytesToMb(5 * 1024 * 1024)).toBe(5);
    expect(bytesToMb(0)).toBe(0);
    // Bit-identical to the inline form for a non-power-of-two byte count: dividing
    // by 1024 is an exact exponent shift, so the two-step and one-step forms agree.
    const arbitrary = 12_345_678;
    expect(bytesToMb(arbitrary)).toBe(arbitrary / 1024 / 1024);
  });
});

describe('bytes→MB division — no re-derivation at the known call sites', () => {
  it('health-check-service delegates heap/rss/external MB to bytesToMb', () => {
    expect(stripComments(healthCheckSrc)).toMatch(/import\s*\{[^}]*\bbytesToMb\b[^}]*\}\s*from\s*['"]@\/lib\/metrics-utils['"]/);
    expect(stripComments(healthCheckSrc)).toMatch(/bytesToMb\s*\(\s*memoryUsage\.heapUsed\s*\)/);
    expect(stripComments(healthCheckSrc)).toMatch(/bytesToMb\s*\(\s*memoryUsage\.rss\s*\)/);
    expect(stripComments(healthCheckSrc)).not.toMatch(BYTES_DIVISION);
    expect(stripComments(healthCheckSrc)).not.toMatch(BYTES_LITERAL);
  });

  it('real-time-performance-monitor delegates heap MB to bytesToMb', () => {
    expect(stripComments(monitorSrc)).toMatch(/import\s*\{[^}]*\bbytesToMb\b[^}]*\}\s*from\s*['"]@\/lib\/metrics-utils['"]/);
    expect(stripComments(monitorSrc)).toMatch(/bytesToMb\s*\(\s*memoryUsage\.heapUsed\s*\)/);
    expect(stripComments(monitorSrc)).not.toMatch(BYTES_DIVISION);
    expect(stripComments(monitorSrc)).not.toMatch(BYTES_LITERAL);
  });
});

describe('bytes→MB division — broad cross-layer sweep', () => {
  // Belt-and-suspenders: no production file anywhere under src/ may re-inline the
  // bytes→MB division. Catches a future site in any dir (incl. .tsx components),
  // not just the known publishers. The canonical definition in metrics-utils.ts
  // is INCLUDED here: its body uses the single-division `/ (1024 * 1024)` form,
  // which the regexes do not match (verified above), so the canonical is the ONE
  // sanctioned definition and a stray re-inline even inside metrics-utils.ts is
  // caught. `* 1024 * 1024` MB→byte CONSTANTS are not the division shape and are
  // never flagged.
  it('no production source file re-derives bytes / 1024 / 1024 (or / 1048576)', () => {
    const files = ([
      ...globSync('src/**/*.ts', { cwd: REPO_ROOT }),
      ...globSync('src/**/*.tsx', { cwd: REPO_ROOT }),
    ] as string[]).filter(f => !f.includes('__tests__'));

    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(resolve(REPO_ROOT, file), 'utf8'));
      if (BYTES_DIVISION.test(src) || BYTES_LITERAL.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
