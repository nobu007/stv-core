export type DiagramType = 'flow' | 'tree' | 'timeline' | 'matrix' | 'cycle';

export type NodeDatum = {
  id: string;
  label: string;
  meta?: {
    importance?: number;
    category?: string;
    icon?: string;
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
  width: number;
  height: number;
  w?: number;
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
};

// ProcessingStatus is now defined in pipeline.ts; re-exported here for backward compatibility
export type { ProcessingStatus } from './pipeline';
export type { PipelineResult as ProcessingResult } from './pipeline';

// ========================================
// Type Guards
// ========================================

const DIAGRAM_TYPES: readonly string[] = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];

export function isDiagramType(value: unknown): value is DiagramType {
  return typeof value === 'string' && DIAGRAM_TYPES.includes(value);
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
