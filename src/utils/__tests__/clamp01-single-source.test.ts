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
      // A re-inlined bare copy must not remain.
      expect(src).not.toMatch(/Math\.max\(0,\s*Math\.min\(1,/);
    });
  }
});
