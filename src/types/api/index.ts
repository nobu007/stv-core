/**
 * API Type Definitions for Enterprise API Server
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

// ============================================================================
// Request Types
// ============================================================================

export interface TranscribeRequest {
  audioFile?: File;
  audioUrl?: string;
  options?: TranscriptionOptions;
}

export interface TranscriptionOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  combineMs?: number;
  optimize?: boolean;
}

export interface GenerateDiagramRequest {
  textContent: string;
  options?: DiagramOptions;
}

export interface DiagramOptions {
  type?: 'auto' | 'flowchart' | 'hierarchy' | 'network' | 'timeline' | 'conceptmap';
  layoutEngine?: 'dagre' | 'force' | 'tree';
  theme?: 'light' | 'dark' | 'auto';
}

export interface GenerateVideoRequest {
  diagramData: DiagramData;
  options?: VideoOptions;
}

export interface VideoOptions {
  resolution?: '720p' | '1080p' | '4k';
  fps?: 30 | 60;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  codec?: 'h264' | 'h265' | 'vp9';
}

export interface BatchRequest {
  requests: Array<{
    type: 'transcribe' | 'generate-diagram' | 'generate-video';
    data: TranscribeRequest | GenerateDiagramRequest | GenerateVideoRequest;
  }>;
  sequential?: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

export interface TranscriptionResult {
  jobId: string;
  text: string;
  captions: Caption[];
  metadata: {
    duration: number;
    language: string;
    confidence: number;
  };
  processingTime: number;
}

export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface DiagramResult {
  jobId: string;
  diagramData: DiagramData;
  metadata: {
    diagramType: string;
    nodeCount: number;
    edgeCount: number;
  };
  processingTime: number;
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layout: LayoutData;
  metadata: {
    type: string;
    title?: string;
  };
}

export interface DiagramNode {
  id: string;
  label: string;
  type: string;
  position?: { x: number; y: number };
  style?: Record<string, any>;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: string;
  style?: Record<string, any>;
}

export interface LayoutData {
  width: number;
  height: number;
  nodes: Record<string, { x: number; y: number; width: number; height: number }>;
}

export interface VideoResult {
  jobId: string;
  videoUrl: string;
  metadata: {
    duration: number;
    resolution: string;
    fps: number;
    fileSize: number;
  };
  processingTime: number;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage?: 'transcription' | 'analysis' | 'visualization' | 'rendering';
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
  currentOperation?: string;
  result?: TranscriptionResult | DiagramResult | VideoResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchJobStatus {
  batchId: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  jobs: JobStatus[];
  overallProgress: number;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
  timestamp: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthToken {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  workspaceId?: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  token: AuthToken;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export interface QuotaInfo {
  monthlyProcessingLimit: number;
  monthlyProcessingUsed: number;
  storageLimit: number;
  storageUsed: number;
  concurrentJobsLimit: number;
  concurrentJobsActive: number;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

export interface WebSocketEvents {
  // Client -> Server
  'job:start': JobStartRequest;
  'job:cancel': JobCancelRequest;
  'settings:update': SettingsUpdate;

  // Server -> Client
  'job:progress': JobProgress;
  'job:complete': JobComplete;
  'job:error': JobError;
  'system:notification': SystemNotification;
}

export interface JobStartRequest {
  jobId: string;
  type: 'transcribe' | 'generate-diagram' | 'generate-video';
}

export interface JobCancelRequest {
  jobId: string;
}

export interface SettingsUpdate {
  settings: Record<string, any>;
}

export interface JobProgress {
  jobId: string;
  stage: 'transcription' | 'analysis' | 'visualization' | 'rendering';
  progress: number;
  estimatedTimeRemaining: number;
  currentOperation: string;
}

export interface JobComplete {
  jobId: string;
  result: TranscriptionResult | DiagramResult | VideoResult;
}

export interface JobError {
  jobId: string;
  error: APIError;
}

export interface SystemNotification {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
}
