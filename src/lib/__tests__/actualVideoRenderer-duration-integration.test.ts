/**
 * Integration test: Scene duration calculation with known timings.
 *
 * Validates that actualVideoRenderer.getComposition produces correct
 * durationInFrames for realistic multi-scene data patterns:
 *   - Real pipeline scene data with varying durations
 *   - Large scene counts (10+)
 *   - Sub-second scenes (edge case)
 *   - Mixed duration patterns
 *   - Comparison with old-bug behavior (would have failed these)
 */

import { jest } from '@jest/globals';
import type { SceneGraph } from '@/types/diagram';

// Mock Remotion dependencies (ESM mode requires unstable_mockModule)
jest.unstable_mockModule('@remotion/bundler', () => ({
  bundle: jest.fn().mockResolvedValue('/tmp/mock-bundle'),
}));

jest.unstable_mockModule('@remotion/renderer', () => ({
  selectComposition: jest.fn().mockResolvedValue({
    durationInFrames: 0,
    fps: 30,
    width: 1920,
    height: 1080,
    id: 'DiagramVideo',
  }),
  renderMedia: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    promises: {
      access: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue('{}'),
    },
  },
}));

const { ActualVideoRenderer } = await import('../actualVideoRenderer');
const { selectComposition } = await import('@remotion/renderer');

function makeRealisticScene(
  id: string,
  durationMs: number,
  startMs: number,
  summary: string,
): SceneGraph {
  return {
    id,
    type: 'flow',
    summary,
    startMs,
    durationMs,
    keyphrases: summary.split(' ').slice(0, 3),
    layout: {
      type: 'flow',
      nodes: [
        { id: `${id}-n1`, label: 'Start', x: 100, y: 100, width: 120, height: 60 },
        { id: `${id}-n2`, label: 'End', x: 300, y: 100, width: 120, height: 60 },
      ],
      edges: [
        { id: `${id}-e1`, source: `${id}-n1`, target: `${id}-n2` },
      ],
      width: 1920,
      height: 1080,
    },
  } as unknown as SceneGraph;
}

async function getDurationInFrames(renderer: ActualVideoRenderer, scenes: SceneGraph[]): Promise<number> {
  try {
    await (renderer as unknown as {
      getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<{ durationInFrames: number }>;
    }).getComposition('/tmp/mock-bundle', scenes);
  } catch {
    // Internal Remotion internals may fail in test env; composition is still set
  }
  const result = await (selectComposition as jest.Mock).mock.results[0].value;
  return result.durationInFrames;
}

const FPS = 30;

describe('ActualVideoRenderer duration integration: known scene timings', () => {
  let renderer: ActualVideoRenderer;

  beforeEach(() => {
    renderer = new ActualVideoRenderer();
    jest.clearAllMocks();
  });

  test('5-scene pipeline: durations sum correctly', async () => {
    // Typical 5-scene breakdown from a 30-second audio segment
    const scenes = [
      makeRealisticScene('intro', 4000, 0, 'Introduction to the topic'),
      makeRealisticScene('overview', 6000, 4000, 'Overview of the system architecture'),
      makeRealisticScene('detail', 8000, 10000, 'Detailed explanation of components'),
      makeRealisticScene('example', 7000, 18000, 'Example use case demonstration'),
      makeRealisticScene('conclusion', 5000, 25000, 'Summary and conclusions'),
    ];

    const frames = await getDurationInFrames(renderer, scenes);
    const expectedMs = 4000 + 6000 + 8000 + 7000 + 5000; // 30000ms
    const expectedFrames = Math.ceil((expectedMs / 1000) * FPS); // 900
    expect(frames).toBe(expectedFrames);

    // OLD BUG: Math.max with default 0-10s → 300 frames (10s), not 900 (30s)
    expect(frames).not.toBe(300);
  });

  test('10-scene pipeline: correct accumulation', async () => {
    // 10 scenes of varying durations
    const durations = [3000, 2500, 4000, 1500, 5000, 3500, 2000, 4500, 3000, 1000];
    let startMs = 0;
    const scenes = durations.map((dur, i) => {
      const scene = makeRealisticScene(`scene-${i}`, dur, startMs, `Scene ${i}`);
      startMs += dur;
      return scene;
    });

    const frames = await getDurationInFrames(renderer, scenes);
    const expectedMs = durations.reduce((a, b) => a + b, 0); // 30000ms
    const expectedFrames = Math.ceil((expectedMs / 1000) * FPS);
    expect(frames).toBe(expectedFrames);
  });

  test('sub-second scenes: minimum 1 second enforced', async () => {
    // Scenes with very short durations (0.1s, 0.3s, 0.5s)
    const scenes = [
      makeRealisticScene('flash1', 100, 0, 'Quick flash 1'),
      makeRealisticScene('flash2', 300, 100, 'Quick flash 2'),
      makeRealisticScene('flash3', 500, 400, 'Quick flash 3'),
    ];

    const frames = await getDurationInFrames(renderer, scenes);
    // 100 + 300 + 500 = 900ms → ceil(0.9 * 30) = 27 frames
    // But minimum is 30 frames (1 second)
    expect(frames).toBeGreaterThanOrEqual(30);
  });

  test('single long scene (60s): correct frames', async () => {
    const scenes = [makeRealisticScene('long', 60000, 0, 'Long single scene')];

    const frames = await getDurationInFrames(renderer, scenes);
    // 60000ms → ceil(60 * 30) = 1800 frames
    expect(frames).toBe(1800);
  });

  test('scenes with zero durationMs default to 10000ms', async () => {
    const scenes = [
      makeRealisticScene('zero1', 0, 0, 'Zero duration scene 1'),
      makeRealisticScene('zero2', 0, 0, 'Zero duration scene 2'),
    ];

    const frames = await getDurationInFrames(renderer, scenes);
    // 0 || 10000 → 10000 + 10000 = 20000ms → 600 frames
    expect(frames).toBe(600);
  });

  test('varying durations produce proportionally correct total', async () => {
    // Verify proportional scaling: double the scenes → double the frames
    const singleScene = [makeRealisticScene('s', 5000, 0, 'Single 5s scene')];
    const doubleScenes = [
      makeRealisticScene('s1', 5000, 0, 'First 5s scene'),
      makeRealisticScene('s2', 5000, 5000, 'Second 5s scene'),
    ];

    const singleFrames = await getDurationInFrames(renderer, singleScene);
    jest.clearAllMocks();
    const doubleFrames = await getDurationInFrames(renderer, doubleScenes);

    // Double scenes should produce exactly double frames
    expect(doubleFrames).toBe(singleFrames * 2);
  });

  test('empty scene array falls back to 10s default', async () => {
    const frames = await getDurationInFrames(renderer, []);
    // 10000ms default → 300 frames
    expect(frames).toBe(300);
  });

  test('TC-257-01: 3-scene cumulative duration (intro 2s + content 5s + outro 1s = 8s)', async () => {
    const scenes = [
      makeRealisticScene('intro', 2000, 0, 'Introduction'),
      makeRealisticScene('content', 5000, 2000, 'Main content'),
      makeRealisticScene('outro', 1000, 7000, 'Conclusion'),
    ];

    const frames = await getDurationInFrames(renderer, scenes);
    // 2s + 5s + 1s = 8s = 8000ms → ceil(8 * 30) = 240 frames
    expect(frames).toBe(240);

    // Verify scene boundaries are correct
    expect(scenes[0].startMs).toBe(0);
    expect(scenes[0].durationMs).toBe(2000);
    expect(scenes[1].startMs).toBe(2000);
    expect(scenes[1].durationMs).toBe(5000);
    expect(scenes[2].startMs).toBe(7000);
    expect(scenes[2].durationMs).toBe(1000);

    // Total = sum of all scene durations
    const totalMs = scenes.reduce((sum, s) => sum + s.durationMs, 0);
    expect(totalMs).toBe(8000);
    expect(frames).toBe(Math.ceil((totalMs / 1000) * FPS));
  });

  test('known timing table: durations vs expected frames', async () => {
    // Table-driven test with known values
    const cases = [
      { durations: [1000], expectedFrames: 30 },       // 1s → 30 frames
      { durations: [2000], expectedFrames: 60 },       // 2s → 60 frames
      { durations: [1500], expectedFrames: 45 },       // 1.5s → 45 frames
      { durations: [1000, 1000], expectedFrames: 60 }, // 2s total → 60 frames
      { durations: [1000, 2000, 3000], expectedFrames: 180 }, // 6s → 180 frames
      { durations: [3333], expectedFrames: 100 },      // 3.333s → ceil(100.0) = 100 frames
    ];

    for (const { durations, expectedFrames } of cases) {
      jest.clearAllMocks();
      const scenes = durations.map((dur, i) => makeRealisticScene(`t${i}`, dur, 0, `Test ${i}`));
      const frames = await getDurationInFrames(renderer, scenes);
      expect(frames).toBe(expectedFrames);
    }
  });
});
