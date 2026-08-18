import type { ConfigSchema } from './schema';
/**
 * Parses a string environment variable as a boolean.
 * Returns the default value if the env var is undefined or empty.
 * Treats 'true', '1', 'yes' as true; everything else as false.
 */
export declare function parseBoolean(value: string | undefined, defaultValue: boolean): boolean;
/**
 * Parses a string environment variable as a number.
 * Returns the default value if the env var is undefined, empty, or NaN.
 */
export declare function parseNumber(value: string | undefined, defaultValue: number): number;
/**
 * Masks a sensitive string value for safe logging.
 * Shows only the first 4 characters and replaces the rest with asterisks.
 * Returns '****' if the value is shorter than 8 characters.
 */
export declare function maskSensitiveValue(value: string): string;
/**
 * Returns a masked version of the config for safe logging.
 * All API keys and sensitive values are replaced with masked versions.
 */
export declare function getMaskedConfig(config: ConfigSchema): Record<string, unknown>;
/**
 * Reads environment variables and returns a validated ConfigSchema object.
 * This is a singleton -- subsequent calls return the same cached instance.
 *
 * @throws Error if required environment variables are missing or validation fails.
 */
export declare function getConfig(): ConfigSchema;
/**
 * Resets the cached config singleton. Useful for testing.
 */
export declare function resetConfig(): void;
