/**
 * Pipeline Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */

import type { SceneGraph } from './diagram';

// ========================================
// Processing Status
// ========================================

export type ProcessingStatus =
  | 'idle'
  | 'uploading'
  | 'transcribing'
  | 'analyzing'
  | 'generating'
  | 'complete'
  | 'error';

const PROCESSING_STATUSES: readonly string[] = [
  'idle',
  'uploading',
  'transcribing',
  'analyzing',
  'generating',
  'complete',
  'error',
];

export function isProcessingStatus(value: unknown): value is ProcessingStatus {
  return typeof value === 'string' && PROCESSING_STATUSES.includes(value);
}

// ========================================
// Pipeline Options
// ========================================

export interface PipelineOptions {
  transcription?: {
    model: 'base' | 'small' | 'medium';
    language?: 'en' | 'ja' | 'auto';
  };
  analysis?: {
    preferredModel?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    maxRetries?: number;
    timeout?: number;
  };
  visualization?: {
    theme?: 'light' | 'dark';
    colorScheme?: string[];
  };
  rendering?: RenderingOptions;
}

// ========================================
// Rendering Options
// ========================================

export interface RenderingOptions {
  fps?: 30 | 60;
  resolution?: '1080p' | '720p' | '4k';
  codec?: 'h264' | 'h265' | 'vp9';
}

// ========================================
// Pipeline Stage
// ========================================

export type PipelineStage =
  | 'transcription'
  | 'analysis'
  | 'visualization'
  | 'animation'
  | 'rendering';

// ========================================
// Pipeline Result
// ========================================

export interface PipelineResult {
  scenes: SceneGraph[];
  audioUrl: string;
  duration: number;
}
