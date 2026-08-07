export type DiagramType = 'flow' | 'flowchart' | 'tree' | 'timeline' | 'matrix' | 'cycle' | 'comparison' | 'network' | 'conceptmap' | 'mindmap' | 'general';

export type NodeDatum = {
  id: string;
  label: string;
  type?: string;
  meta?: {
    importance?: number;
    category?: string;
    icon?: string;
    mergedIds?: string[];
  };
  width?: number;
  height?: number;
};

export type EdgeDatum = {
  from: string;
  to: string;
  label?: string;
  id?: string;
  source?: string;
  target?: string;
  type?: string;
};

export type PositionedNode = NodeDatum & {
  x: number;
  y: number;
  width?: number;
  height?: number;
  /**
   * @deprecated Use `width` instead.  The `getNodeWidth()` helper in
   * `visualization/node-dimensions.ts` reads `width` first, then falls
   * back to `w`.  Direct access to `.w` bypasses the NaN guard.
   * Will be removed once all producers write `width`.
   */
  w?: number;
  /**
   * @deprecated Use `height` instead.  The `getNodeHeight()` helper in
   * `visualization/node-dimensions.ts` reads `height` first, then falls
   * back to `h`.  Direct access to `.h` bypasses the NaN guard.
   * Will be removed once all producers write `height`.
   */
  h?: number;
};

export type LayoutEdge = {
  from?: string;
  to?: string;
  points: { x: number; y: number }[];
  label?: string;
  id?: string;
  source?: string;
  target?: string;
  type?: string;
};

export type DiagramLayout = {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
  bounds?: { x: number; y: number; width: number; height: number };
  center?: { x: number; y: number };
};

export type SceneGraph = {
  type: DiagramType;
  nodes: NodeDatum[];
  edges: EdgeDatum[];
  layout?: DiagramLayout;
  startMs: number;
  durationMs: number;
  summary: string;
  keyphrases: string[];
  startTime?: number;
  endTime?: number;
  id?: string;
  content?: string;
  confidence?: number;
  title?: string;
  diagramType?: string;
};

// ProcessingStatus is now defined in pipeline.ts; re-exported here for backward compatibility
export type { ProcessingStatus } from './pipeline';
export type { PipelineResult as ProcessingResult } from './pipeline';

// ========================================
// Type Guards
// ========================================

/**
 * Canonical, single-source list of every `DiagramType`.
 *
 * Exported so consumers iterate the canonical set instead of re-literalizing
 * the union (which silently drifts when a type is added — e.g. a scoring loop
 * re-literalizing this list would skip a newly-added type because the
 * accompanying `as DiagramType[]` cast defeats the type-checker). Typed as
 * `readonly DiagramType[]` so mapped values infer `DiagramType` directly.
 */
export const DIAGRAM_TYPES: readonly DiagramType[] = ['flow', 'flowchart', 'tree', 'timeline', 'matrix', 'cycle', 'comparison', 'network', 'conceptmap', 'mindmap', 'general'];

export function isDiagramType(value: unknown): value is DiagramType {
  return typeof value === 'string' && (DIAGRAM_TYPES as readonly string[]).includes(value);
}

export function isNodeDatum(value: unknown): value is NodeDatum {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.label === 'string';
}

export function isEdgeDatum(value: unknown): value is EdgeDatum {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.from === 'string' && typeof obj.to === 'string';
}
