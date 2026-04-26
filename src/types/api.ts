/**
 * API Type Definitions (Pipeline API types)
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */

import type { SceneGraph } from './diagram';
import type { ProcessingStatus } from './pipeline';

// ========================================
// API Response / Error
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ========================================
// Batch Processing
// ========================================

export interface BatchJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  files: BatchFile[];
  progress: number;
  eta?: number;
  qualityScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchFile {
  filename: string;
  status: ProcessingStatus;
  result?: SceneGraph[];
  error?: string;
}

// ========================================
// Progress Events
// ========================================

export interface ProgressEvent {
  stage: string;
  progress: number;
  message?: string;
  timestamp: number;
}
