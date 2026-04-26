/**
 * Configuration schema for speech-to-visuals application.
 * Defines the shape of the validated configuration object.
 */
export interface ConfigSchema {
  googleApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  analysisDisableGemini: boolean;
  geminiModelOverride?: string;
  complexityThreshold: number;
  cacheSize: number;
  cacheTtlMinutes: number;
  similarityThreshold: number;
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
}
