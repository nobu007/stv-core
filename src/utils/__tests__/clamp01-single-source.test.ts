import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Structural guard for the single-source `clamp01`.
 *
 * `Math.max(0, Math.min(1, x))` was previously inlined at eight sites plus a
 * private quality-monitor method. These tests forbid re-introducing a bare
 * inline copy at any former site (the moment anyone does, this fails), turning
 * a latent duplicate-formula drift hazard into a build-time failure.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

// Every former inline site — each must import the canonical helper and must not
// re-inline `Math.max(0, Math.min(1, …))`.
const SITES = [
  'src/analysis/llm-service.ts',
  'src/analysis/semantic-similarity.ts',
  'src/visualization/importance-scaler.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
  'src/visualization/strategies/LayoutEvaluator.ts',
  'src/performance/intelligent-cache.ts',
  'src/visualization/layout-quality-composite.ts',
  'src/quality/quality-monitor.ts',
];

describe('clamp01 — no former site re-inlines the formula', () => {
  for (const rel of SITES) {
    it(`${rel} imports clamp01 and does not re-inline Math.max(0, Math.min(1, …))`, () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      // NOTE: this Jest build's `expect(value, message)` takes 1 arg only.
      expect(src).toContain("from '@/utils/guards'");
      expect(src).toMatch(/\bclamp01\b/);
      // A re-inlined bare copy must not remain — in EITHER operand order. The
      // canonical clamps `value` to [0,1]; `Math.max(0, Math.min(1, x))` and
      // `Math.min(1, Math.max(0, x))` are the SAME formula with the outer/inner
      // calls swapped. A guard that checks only one order (as this previously
      // did) lets a reversed-order copy survive undetected — which is exactly
      // how a residual stayed inline at enhanced-zero-overlap-layout.ts after
      // the original sweep. Both orders are forbidden here.
      //
      // Test CODE only: strip `//` line comments and `/* */` block comments
      // first, so a rationale comment that quotes the formula (e.g. the note
      // under the call site that explains WHY it delegates) does not itself
      // match the guard and false-positive.
      const code = src
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/Math\.max\(0,\s*Math\.min\(1,/);
      expect(code).not.toMatch(/Math\.min\(1,\s*Math\.max\(0,/);
    });
  }
});
