import type { ConfigSchema } from './schema';
/**
 * Represents a single validation error for a configuration field.
 */
export interface ValidationError {
    field: string;
    message: string;
}
/**
 * Validates a partial config object and returns an array of validation errors.
 * Returns an empty array if the configuration is valid.
 */
export declare function validateConfig(config: Partial<ConfigSchema>): ValidationError[];
/**
 * Validates that a string is a valid URL.
 * Returns null if valid, or a ValidationError if invalid.
 */
export declare function validateUrl(url: string, fieldName: string): ValidationError | null;
/**
 * Validates that a number falls within the specified range (inclusive).
 * Returns null if valid, or a ValidationError if invalid.
 */
export declare function validateNumberRange(value: number, min: number, max: number, fieldName: string): ValidationError | null;
