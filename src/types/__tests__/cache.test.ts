/**
 * Tests for Cache types
 */

import type { CacheEntry } from '../cache';

describe('CacheEntry', () => {
  test('can create a CacheEntry with all fields', () => {
    const entry: CacheEntry<string> = {
      key: 'test-key',
      embedding: [0.1, 0.2, 0.3],
      result: 'cached result',
      timestamp: Date.now(),
      ttl: 7200000,
    };
    expect(entry.key).toBe('test-key');
    expect(entry.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(entry.result).toBe('cached result');
    expect(typeof entry.timestamp).toBe('number');
    expect(entry.ttl).toBe(7200000);
  });

  test('CacheEntry result can hold complex objects', () => {
    interface AnalysisResult {
      entities: string[];
      score: number;
    }
    const result: AnalysisResult = { entities: ['A', 'B'], score: 0.95 };
    const entry: CacheEntry<AnalysisResult> = {
      key: 'analysis-1',
      embedding: [0.5, 0.6],
      result,
      timestamp: Date.now(),
      ttl: 3600000,
    };
    expect(entry.result.entities).toEqual(['A', 'B']);
    expect(entry.result.score).toBeCloseTo(0.95);
  });
});
