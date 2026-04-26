/**
 * Configuration module barrel export.
 * Provides type-safe access to application configuration.
 */
export type { ConfigSchema } from './schema';
export { validateConfig, validateUrl, validateNumberRange } from './validate';
export type { ValidationError } from './validate';
export { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from './env';
