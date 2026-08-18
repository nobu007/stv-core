/**
 * Quality Monitoring Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */
export interface QualityMetrics {
    phase: number;
    timestamp: string;
    overall: {
        successRate: number;
        processingTime: number;
        status: 'PASS' | 'FAIL' | 'WARNING';
    };
    stages: {
        transcription: StageMetrics;
        analysis: StageMetrics;
        visualization: StageMetrics;
        animation: StageMetrics;
        rendering: StageMetrics;
    };
    quality: {
        entityF1: number;
        relationshipAccuracy: number;
        edgeCompleteness: number;
    };
}
export interface StageMetrics {
    success: boolean;
    duration: number;
    qualityScore: number;
    errors: string[];
}
export interface QualityScore {
    overall: number;
    entityF1: number;
    relationshipAccuracy: number;
    edgeCompleteness: number;
    passed: boolean;
}
export interface QualityGate {
    name: string;
    threshold: number;
    metric: keyof QualityScore;
    enabled: boolean;
}
