/**
 * LLM Service Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */

// ========================================
// LLM Model
// ========================================

export type LLMModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

const LLM_MODELS: readonly string[] = ['gemini-2.5-flash', 'gemini-2.5-pro'];

export function isLLMModel(value: unknown): value is LLMModel {
  return typeof value === 'string' && LLM_MODELS.includes(value);
}

// ========================================
// Complexity Analysis
// ========================================

export interface ComplexityAnalysis {
  score: number;
  recommendedModel: LLMModel;
  factors: string[];
}

// ========================================
// LLM Request / Response
// ========================================

export interface LLMRequest<T> {
  prompt: string;
  context: string;
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    forceModel?: LLMModel;
    timeout?: number;
    enableStreaming?: boolean;
  };
  parseResponse: (raw: string) => T;
}

export interface LLMResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    model: string;
    responseTime: number;
    fromCache: boolean;
    complexity?: ComplexityAnalysis;
    retryCount: number;
    fallbackUsed: boolean;
  };
}
