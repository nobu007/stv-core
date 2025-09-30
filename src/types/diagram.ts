export type DiagramType = 'flow' | 'tree' | 'timeline' | 'matrix' | 'cycle';

export type NodeDatum = {
  id: string;
  label: string;
  meta?: {
    importance?: number;
    category?: string;
    icon?: string;
  };
};

export type EdgeDatum = {
  from: string;
  to: string;
  label?: string;
};

export type PositionedNode = NodeDatum & {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LayoutEdge = {
  from: string;
  to: string;
  points: { x: number; y: number }[];
  label?: string;
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

export type ProcessingStatus = 
  | 'idle' 
  | 'uploading' 
  | 'transcribing' 
  | 'analyzing' 
  | 'generating' 
  | 'complete' 
  | 'error';

export type ProcessingResult = {
  scenes: SceneGraph[];
  audioUrl: string;
  duration: number;
};
