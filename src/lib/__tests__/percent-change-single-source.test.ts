import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { percentChange } from '@/lib/metrics-utils';
import { compareWithBaseline } from '@/pipeline/performance-regression-detector';
import { compareCostEfficiency } from '@/pipeline/cost-efficiency-metrics';

/**
 * Propagation + structural guard for the single-source `percentChange`.
 *
 * Four modules previously each re-derived the percent-change formula with
 * drifting denominators (regression-detector used `Math.abs`, the other three
 * used the raw baseline). `compareWithBaseline` and `compareCostEfficiency` are
 * pure-function consumers whose regression decisions feed the pipeline
 * health/regression gates; these tests prove they delegate to the canonical
 * helper rather than re-deriving — including a divergent sentinel (negative
 * baseline) that the raw-denominator copy cannot reproduce.
 */

describe('percentChange — pure-consumer delegation', () => {
  it('compareWithBaseline derives regressionPercent from the canonical helper', () => {
    // Positive baseline (the realistic case): every reachable baseline is
    // non-negative, so the raw and abs forms agree here. This pins that
    // agreement so a future denominator change is caught.
    const baselines = [
      { stage: 'transcription', maxDurationMs: 8000, maxMemoryMB: 50, targetDurationMs: 8000 },
    ];
    const measurement = { stage: 'transcription', durationMs: 10000, memoryMB: 40 };
    const result = compareWithBaseline(measurement, baselines);
    expect(result.regressionPercent).toBe(percentChange(10000, 8000)); // +25
    expect(result.isRegression).toBe(true); // >= 10% threshold
  });

  it('compareWithBaseline reproduces the canonical sign for a NEGATIVE-baseline sentinel', () => {
    // DIVERGENT SENTINEL: a signed baseline (maxDurationMs = -1000) is the
    // distinctive value the raw-denominator re-derivation cannot reproduce.
    //   canonical (abs): ((0 - -1000) / |-1000|) * 100 = +100
    //   raw (drifted):   ((0 - -1000) / -1000)  * 100 = -100  ← sign-flipped
    // The consumer MUST match the canonical +100. If anyone re-inlines the raw
    // formula, this fails at -100.
    const sentinelBaselines = [
      { stage: 'sentinel', maxDurationMs: -1000, maxMemoryMB: 100, targetDurationMs: 1000 },
    ];
    const result = compareWithBaseline(
      { stage: 'sentinel', durationMs: 0, memoryMB: 50 },
      sentinelBaselines,
    );
    expect(result.regressionPercent).toBe(percentChange(0, -1000)); // +100
    expect(result.baselineMs).toBe(-1000);
  });

  it('compareCostEfficiency gates cost/token regression on the canonical helper', () => {
    // costPerVideo 0.012 vs baseline 0.01 = +20% (clearly above the 10% threshold → regression)
    const at = compareCostEfficiency(
      { costPerVideo: 0.012, tokensPerAnalysis: 100, totalCostUsd: 0, totalTokens: 0 },
      0.01,
      100,
    );
    expect(percentChange(0.012, 0.01)).toBeCloseTo(20, 5);
    expect(at.costRegression).toBe(true);

    // 5% is below the 10% threshold → no regression
    const below = compareCostEfficiency(
      { costPerVideo: 0.0105, tokensPerAnalysis: 100, totalCostUsd: 0, totalTokens: 0 },
      0.01,
      100,
    );
    expect(percentChange(0.0105, 0.01)).toBeCloseTo(5, 5);
    expect(below.costRegression).toBe(false);
  });
});

/**
 * Structural guard: every former inline site must import the canonical helper
 * and must not re-inline a raw `((x - baseline) / baseline) * 100` percent-change
 * formula. This converts a latent drift hazard into a build-time failure the
 * moment anyone reintroduces a divergent local copy.
 */
describe('percentChange — no consumer re-inlines the formula', () => {
  const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  const SITES = [
    'src/quality/regression-detector.ts',
    'src/pipeline/performance-regression-detector.ts',
    'src/pipeline/cost-efficiency-metrics.ts',
    'src/pipeline/quality-monitor.ts',
  ];

  for (const rel of SITES) {
    it(`${rel} imports percentChange and does not re-inline the formula`, () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      // NOTE: this Jest build's `expect(value, message)` takes 1 arg only, so
      // messages are plain comments rather than the 2nd expect argument.
      // 1. must import the canonical helper
      expect(src).toContain("from '@/lib/metrics-utils'");
      // 2. must reference percentChange (not just import it unused)
      expect(src).toMatch(/percentChange/);
      // 3. must NOT re-inline the abs-denominator form `/ Math.abs(...) ) * 100`
      expect(src).not.toMatch(/\/\s*Math\.abs\([^)]*\)\s*\)\s*\*\s*100/);
      // 4. must NOT re-inline a raw-denominator form `/ baseline…) * 100`
      expect(src).not.toMatch(/\/\s*baseline[A-Za-z_]*\s*\)\s*\*\s*100/);
    });
  }
});
