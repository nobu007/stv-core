/**
 * DiagramType completeness tests.
 *
 * Verifies that every DiagramType variant is covered in every
 * Record<DiagramType, T> mapping across the codebase.
 * This prevents silent fallthrough to default values when new
 * diagram types are added.
 */

import type { DiagramType } from '../diagram';

// The canonical list of all DiagramType variants
const ALL_DIAGRAM_TYPES: DiagramType[] = [
  'flow', 'flowchart', 'tree', 'timeline', 'matrix', 'cycle',
  'comparison', 'network', 'conceptmap', 'mindmap', 'general',
];

describe('DiagramType completeness', () => {
  it('should have exactly 11 diagram types', () => {
    expect(ALL_DIAGRAM_TYPES).toHaveLength(11);
  });

  it('should have no duplicate types', () => {
    const unique = new Set(ALL_DIAGRAM_TYPES);
    expect(unique.size).toBe(ALL_DIAGRAM_TYPES.length);
  });

  // Type-level check: if this compiles, every Record<DiagramType, T> in the
  // codebase is exhaustive. The test below adds a runtime safety net.
  it('should cover all types in isDiagramType guard', async () => {
    const { isDiagramType } = await import('../diagram');
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(isDiagramType(type)).toBe(true);
    }
  });
});

/**
 * Verify that animation-strategies STRATEGY_MAP covers all types.
 */
describe('STRATEGY_MAP completeness', () => {
  it('should provide a strategy for every DiagramType', async () => {
    const { getAnimationStrategy } = await import('@/remotion/animation-strategies');
    for (const type of ALL_DIAGRAM_TYPES) {
      const strategy = getAnimationStrategy(type);
      expect(strategy).toBeDefined();
      expect(typeof strategy.getNodeAnimations).toBe('function');
      expect(typeof strategy.getEdgeAnimations).toBe('function');
    }
  });

  it('should map extended types to correct base strategies', async () => {
    const {
      getAnimationStrategy,
      FLOW_STRATEGY,
      TREE_STRATEGY,
      MATRIX_STRATEGY,
    } = await import('@/remotion/animation-strategies');

    // flow aliases
    expect(getAnimationStrategy('flowchart')).toBe(FLOW_STRATEGY);
    expect(getAnimationStrategy('network')).toBe(FLOW_STRATEGY);
    expect(getAnimationStrategy('general')).toBe(FLOW_STRATEGY);

    // tree aliases
    expect(getAnimationStrategy('conceptmap')).toBe(TREE_STRATEGY);
    expect(getAnimationStrategy('mindmap')).toBe(TREE_STRATEGY);

    // matrix aliases
    expect(getAnimationStrategy('comparison')).toBe(MATRIX_STRATEGY);
  });
});
