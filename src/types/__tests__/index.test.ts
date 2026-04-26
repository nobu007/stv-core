/**
 * Tests for barrel exports
 * Verifies that all types and functions are re-exported from index.ts
 */

import * as barrel from '../index';

describe('Barrel exports', () => {
  test('exports type guard functions', () => {
    expect(typeof barrel.isDiagramType).toBe('function');
    expect(typeof barrel.isNodeDatum).toBe('function');
    expect(typeof barrel.isEdgeDatum).toBe('function');
    expect(typeof barrel.isProcessingStatus).toBe('function');
    expect(typeof barrel.isLLMModel).toBe('function');
  });

  test('isDiagramType works through barrel', () => {
    expect(barrel.isDiagramType('flow')).toBe(true);
    expect(barrel.isDiagramType('invalid')).toBe(false);
  });

  test('isNodeDatum works through barrel', () => {
    expect(barrel.isNodeDatum({ id: '1', label: 'test' })).toBe(true);
    expect(barrel.isNodeDatum({ id: '1' })).toBe(false);
  });

  test('isEdgeDatum works through barrel', () => {
    expect(barrel.isEdgeDatum({ from: 'a', to: 'b' })).toBe(true);
    expect(barrel.isEdgeDatum({ from: 'a' })).toBe(false);
  });

  test('isProcessingStatus works through barrel', () => {
    expect(barrel.isProcessingStatus('idle')).toBe(true);
    expect(barrel.isProcessingStatus('running')).toBe(false);
  });

  test('isLLMModel works through barrel', () => {
    expect(barrel.isLLMModel('gemini-2.5-flash')).toBe(true);
    expect(barrel.isLLMModel('invalid')).toBe(false);
  });

  test('does not export undefined values for type-only exports', () => {
    // Type-only exports should not appear as runtime values
    // Functions should be available
    expect(barrel.isDiagramType).toBeDefined();
    expect(barrel.isNodeDatum).toBeDefined();
    expect(barrel.isEdgeDatum).toBeDefined();
    expect(barrel.isProcessingStatus).toBeDefined();
    expect(barrel.isLLMModel).toBeDefined();
  });
});
