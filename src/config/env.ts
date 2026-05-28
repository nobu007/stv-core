import type { ConfigSchema } from './schema';
import { validateConfig } from './validate';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';

/** Cached singleton config instance */
let cachedConfig: ConfigSchema | null = null;

/**
 * Parses a string environment variable as a boolean.
 * Returns the default value if the env var is undefined or empty.
 * Treats 'true', '1', 'yes' as true; everything else as false.
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Parses a string environment variable as a number.
 * Returns the default value if the env var is undefined, empty, or NaN.
 */
export function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Masks a sensitive string value for safe logging.
 * Shows only the first 4 characters and replaces the rest with asterisks.
 * Returns '****' if the value is shorter than 8 characters.
 */
export function maskSensitiveValue(value: string): string {
  if (value.length < 8) {
    return '****';
  }
  return value.substring(0, 4) + '*'.repeat(value.length - 4);
}

/**
 * Returns a masked version of the config for safe logging.
 * All API keys and sensitive values are replaced with masked versions.
 */
export function getMaskedConfig(config: ConfigSchema): Record<string, unknown> {
  return {
    googleApiKey: maskSensitiveValue(config.googleApiKey),
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: maskSensitiveValue(config.supabaseAnonKey),
    analysisDisableGemini: config.analysisDisableGemini,
    geminiModelOverride: config.geminiModelOverride,
    complexityThreshold: config.complexityThreshold,
    cacheSize: config.cacheSize,
    cacheTtlMinutes: config.cacheTtlMinutes,
    similarityThreshold: config.similarityThreshold,
    port: config.port,
    nodeEnv: config.nodeEnv,
  };
}

/**
 * Reads environment variables and returns a validated ConfigSchema object.
 * This is a singleton -- subsequent calls return the same cached instance.
 *
 * @throws Error if required environment variables are missing or validation fails.
 */
export function getConfig(): ConfigSchema {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const rawConfig: Partial<ConfigSchema> = {
    googleApiKey: process.env.GOOGLE_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    analysisDisableGemini: parseBoolean(process.env.ANALYSIS_DISABLE_GEMINI, false),
    geminiModelOverride: process.env.GEMINI_MODEL_OVERRIDE || undefined,
    complexityThreshold: parseNumber(process.env.COMPLEXITY_THRESHOLD, 0.2),
    cacheSize: parseNumber(process.env.CACHE_SIZE, 200),
    cacheTtlMinutes: parseNumber(process.env.CACHE_TTL_MINUTES, 120),
    similarityThreshold: parseNumber(process.env.SIMILARITY_THRESHOLD, 0.9),
    port: parseNumber(process.env.PORT, 3001),
    nodeEnv: (process.env.NODE_ENV as ConfigSchema['nodeEnv']) || 'development',
  };

  const errors = validateConfig(rawConfig);
  if (errors.length > 0) {
    const errorMessages = errors
      .map((e) => `  - ${e.field}: ${e.message}`)
      .join('\n');
    throw new PipelineConfigError('env', `Configuration validation failed:\n${errorMessages}`);
  }

  cachedConfig = rawConfig as ConfigSchema;
  return cachedConfig;
}

/**
 * Resets the cached config singleton. Useful for testing.
 */
export function resetConfig(): void {
  cachedConfig = null;
}
