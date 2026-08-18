/**
 * LLM Service Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */
export type LLMModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';
export declare function isLLMModel(value: unknown): value is LLMModel;
export interface ComplexityAnalysis {
    score: number;
    recommendedModel: LLMModel;
    factors: string[];
}
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
