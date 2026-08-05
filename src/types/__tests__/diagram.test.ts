/**
 * Tests for diagram type guards
 */

import { isDiagramType, isNodeDatum, isEdgeDatum } from '../diagram';

describe('isDiagramType', () => {
  const validValues: string[] = [
    'flow', 'flowchart', 'tree', 'timeline', 'matrix', 'cycle',
    'comparison', 'network', 'conceptmap', 'mindmap', 'general',
  ];

  test.each(validValues)('returns true for valid DiagramType: %s', (value) => {
    expect(isDiagramType(value)).toBe(true);
  });

  test('returns false for invalid string values', () => {
    expect(isDiagramType('invalid')).toBe(false);
    expect(isDiagramType('Flow')).toBe(false);
    expect(isDiagramType('')).toBe(false);
    expect(isDiagramType('FLOW')).toBe(false);
  });

  test('returns false for non-string values', () => {
    expect(isDiagramType(123)).toBe(false);
    expect(isDiagramType(null)).toBe(false);
    expect(isDiagramType(undefined)).toBe(false);
    expect(isDiagramType({})).toBe(false);
    expect(isDiagramType([])).toBe(false);
    expect(isDiagramType(true)).toBe(false);
  });
});

describe('isNodeDatum', () => {
  test('returns true for valid NodeDatum', () => {
    expect(isNodeDatum({ id: 'node-1', label: 'Start' })).toBe(true);
  });

  test('returns true for NodeDatum with optional fields', () => {
    expect(
      isNodeDatum({
        id: 'node-1',
        label: 'Start',
        meta: { importance: 1, category: 'process', icon: 'circle' },
        width: 100,
        height: 50,
      }),
    ).toBe(true);
  });

  test('returns false when id is missing', () => {
    expect(isNodeDatum({ label: 'Start' })).toBe(false);
  });

  test('returns false when label is missing', () => {
    expect(isNodeDatum({ id: 'node-1' })).toBe(false);
  });

  test('returns false when id is not a string', () => {
    expect(isNodeDatum({ id: 123, label: 'Start' })).toBe(false);
  });

  test('returns false when label is not a string', () => {
    expect(isNodeDatum({ id: 'node-1', label: 456 })).toBe(false);
  });

  test('returns false for null', () => {
    expect(isNodeDatum(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isNodeDatum(undefined)).toBe(false);
  });

  test('returns false for primitive values', () => {
    expect(isNodeDatum('string')).toBe(false);
    expect(isNodeDatum(42)).toBe(false);
    expect(isNodeDatum(true)).toBe(false);
  });
});

describe('isEdgeDatum', () => {
  test('returns true for valid EdgeDatum', () => {
    expect(isEdgeDatum({ from: 'node-1', to: 'node-2' })).toBe(true);
  });

  test('returns true for EdgeDatum with optional fields', () => {
    expect(
      isEdgeDatum({
        from: 'node-1',
        to: 'node-2',
        label: 'connects',
        type: 'arrow',
      }),
    ).toBe(true);
  });

  test('returns false when from is missing', () => {
    expect(isEdgeDatum({ to: 'node-2' })).toBe(false);
  });

  test('returns false when to is missing', () => {
    expect(isEdgeDatum({ from: 'node-1' })).toBe(false);
  });

  test('returns false when from is not a string', () => {
    expect(isEdgeDatum({ from: 123, to: 'node-2' })).toBe(false);
  });

  test('returns false when to is not a string', () => {
    expect(isEdgeDatum({ from: 'node-1', to: 456 })).toBe(false);
  });

  test('returns false for null', () => {
    expect(isEdgeDatum(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isEdgeDatum(undefined)).toBe(false);
  });

  test('returns false for primitive values', () => {
    expect(isEdgeDatum('string')).toBe(false);
    expect(isEdgeDatum(42)).toBe(false);
  });
});
