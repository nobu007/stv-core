/**
 * Pipeline Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */
import type { SceneGraph } from './diagram';
export type ProcessingStatus = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating' | 'complete' | 'error';
export declare function isProcessingStatus(value: unknown): value is ProcessingStatus;
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
export interface RenderingOptions {
    fps?: 30 | 60;
    resolution?: '1080p' | '720p' | '4k';
    codec?: 'h264' | 'h265' | 'vp9';
}
export type PipelineStage = 'transcription' | 'analysis' | 'visualization' | 'animation' | 'rendering';
export interface PipelineResult {
    scenes: SceneGraph[];
    audioUrl: string;
    duration: number;
}
