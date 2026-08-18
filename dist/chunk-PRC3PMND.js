import {
  validateConfig
} from "./chunk-42HA3C7L.js";
import {
  ConfigValidationError
} from "./chunk-7UHITSZI.js";

// src/config/env.ts
var cachedConfig = null;
function parseBoolean(value, defaultValue) {
  if (value === void 0 || value === "") {
    return defaultValue;
  }
  return value === "true" || value === "1" || value === "yes";
}
function parseNumber(value, defaultValue) {
  if (value === void 0 || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}
function maskSensitiveValue(value) {
  if (value.length < 8) {
    return "****";
  }
  return value.substring(0, 4) + "*".repeat(value.length - 4);
}
function getMaskedConfig(config) {
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
    nodeEnv: config.nodeEnv
  };
}
function getConfig() {
  if (cachedConfig !== null) {
    return cachedConfig;
  }
  const rawConfig = {
    googleApiKey: process.env.GOOGLE_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    analysisDisableGemini: parseBoolean(process.env.ANALYSIS_DISABLE_GEMINI, false),
    geminiModelOverride: process.env.GEMINI_MODEL_OVERRIDE || void 0,
    complexityThreshold: parseNumber(process.env.COMPLEXITY_THRESHOLD, 0.2),
    cacheSize: parseNumber(process.env.CACHE_SIZE, 200),
    cacheTtlMinutes: parseNumber(process.env.CACHE_TTL_MINUTES, 120),
    similarityThreshold: parseNumber(process.env.SIMILARITY_THRESHOLD, 0.9),
    port: parseNumber(process.env.PORT, 3001),
    nodeEnv: process.env.NODE_ENV || "development"
  };
  const errors = validateConfig(rawConfig);
  if (errors.length > 0) {
    const errorMessages = errors.map((e) => `  - ${e.field}: ${e.message}`).join("\n");
    throw new ConfigValidationError("env", `Configuration validation failed:
${errorMessages}`);
  }
  cachedConfig = rawConfig;
  return cachedConfig;
}
function resetConfig() {
  cachedConfig = null;
}

export {
  parseBoolean,
  parseNumber,
  maskSensitiveValue,
  getMaskedConfig,
  getConfig,
  resetConfig
};
