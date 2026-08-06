/**
 * Tests for ActualVideoRenderer scene duration calculation
 * Verifies fix: duration must accumulate via scene.durationMs, not use
 * incorrect Math.max with default startTime/endTime that ignores multi-scene timelines.
 */

import { jest } from '@jest/globals';
import type { SceneGraph } from '@/types/diagram';
import { COMPOSITION_ID } from '@/remotion/composition-id';

// Mock Remotion dependencies (ESM mode requires unstable_mockModule)
jest.unstable_mockModule('@remotion/bundler', () => ({
  bundle: jest.fn().mockResolvedValue('/tmp/mock-bundle'),
}));

jest.unstable_mockModule('@remotion/renderer', () => ({
  selectComposition: jest.fn().mockResolvedValue({
    durationInFrames: 0, // will be overwritten
    fps: 30,
    width: 1920,
    height: 1080,
    id: COMPOSITION_ID,
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

function makeScene(id: string, durationMs: number, startTime?: number, endTime?: number): SceneGraph {
  return {
    id,
    summary: `Scene ${id}`,
    startMs: 0,
    durationMs,
    keyphrases: [],
    layout: {
      type: 'general',
      nodes: [],
      edges: [],
      width: 1920,
      height: 1080,
    },
    ...(startTime !== undefined ? { startTime } : {}),
    ...(endTime !== undefined ? { endTime } : {}),
  } as SceneGraph;
}

describe('ActualVideoRenderer scene duration calculation', () => {
  let renderer: ActualVideoRenderer;

  beforeEach(() => {
    renderer = new ActualVideoRenderer();
    jest.clearAllMocks();
  });

  /**
   * Key bug: When scenes lack startTime/endTime, the old code defaulted ALL scenes
   * to 0-10s range and used Math.max, producing 10000ms total regardless of scene count.
   * The fix uses scene.durationMs accumulation.
   */
  it('should accumulate durationMs across multiple scenes without startTime/endTime', async () => {
    const scenes = [
      makeScene('s1', 5000), // 5s
      makeScene('s2', 3000), // 3s
      makeScene('s3', 2000), // 2s
    ];

    // Access private getComposition via renderVideo path
    // selectComposition is called internally; check the durationInFrames set on composition
    try {
      await (renderer as unknown as { getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<{ durationInFrames: number }> })
        .getComposition('/tmp/mock-bundle', scenes);
    } catch {
      // May fail on missing Remotion internals, that's OK
    }

    const call = (selectComposition as jest.Mock).mock.calls[0];
    const composition = await (selectComposition as jest.Mock).mock.results[0].value;

    // Total should be 5000 + 3000 + 2000 = 10000ms => ceil(10 * 30) = 300 frames
    expect(composition.durationInFrames).toBe(300);
  });

  it('should handle single scene with durationMs', async () => {
    const scenes = [makeScene('s1', 7000)];

    try {
      await (renderer as unknown as { getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<{ durationInFrames: number }> })
        .getComposition('/tmp/mock-bundle', scenes);
    } catch {
      // OK if internals fail
    }

    const composition = await (selectComposition as jest.Mock).mock.results[0].value;
    // 7000ms => ceil(7 * 30) = 210 frames
    expect(composition.durationInFrames).toBe(210);
  });

  it('should enforce minimum 1 second (30 frames) for very short scenes', async () => {
    const scenes = [makeScene('s1', 100)]; // 0.1s

    try {
      await (renderer as unknown as { getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<{ durationInFrames: number }> })
        .getComposition('/tmp/mock-bundle', scenes);
    } catch {
      // OK
    }

    const composition = await (selectComposition as jest.Mock).mock.results[0].value;
    expect(composition.durationInFrames).toBeGreaterThanOrEqual(30);
  });

  it('should produce longer total for more scenes (old bug: all scenes = same 10s)', async () => {
    // Old code: 5 scenes without timestamps → all default to 0-10s → Math.max = 10000ms = 300 frames
    // New code: 5 scenes × 5000ms = 25000ms = 750 frames
    const scenes = Array.from({ length: 5 }, (_, i) => makeScene(`s${i}`, 5000));

    try {
      await (renderer as unknown as { getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<{ durationInFrames: number }> })
        .getComposition('/tmp/mock-bundle', scenes);
    } catch {
      // OK
    }

    const composition = await (selectComposition as jest.Mock).mock.results[0].value;
    // 5 × 5000ms = 25000ms => ceil(25 * 30) = 750 frames
    // Old code would have given 300 frames (incorrect)
    expect(composition.durationInFrames).toBe(750);
  });

  it('should handle empty scenes array with 10s default', async () => {
    const scenes: SceneGraph[] = [];

    try {
      await (renderer as unknown as { getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<{ durationInFrames: number }> })
        .getComposition('/tmp/mock-bundle', scenes);
    } catch {
      // OK
    }

    const composition = await (selectComposition as jest.Mock).mock.results[0].value;
    // Default 10000ms => 300 frames
    expect(composition.durationInFrames).toBe(300);
  });

  it('should use durationMs even when startTime/endTime are present', async () => {
    // Scenes with both durationMs and startTime/endTime
    // Fix should use durationMs (not Math.max of absolute end times)
    const scenes = [
      makeScene('s1', 4000, 0, 4),
      makeScene('s2', 6000, 4, 10),
    ];

    try {
      await (renderer as unknown as { getComposition: (bundle: string, scenes: SceneGraph[]) => Promise<{ durationInFrames: number }> })
        .getComposition('/tmp/mock-bundle', scenes);
    } catch {
      // OK
    }

    const composition = await (selectComposition as jest.Mock).mock.results[0].value;
    // New code: 4000 + 6000 = 10000ms => 300 frames
    expect(composition.durationInFrames).toBe(300);
  });
});
