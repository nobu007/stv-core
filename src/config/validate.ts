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
export function validateConfig(config: Partial<ConfigSchema>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!config.googleApiKey) {
    errors.push({ field: 'googleApiKey', message: 'GOOGLE_API_KEY is required' });
  }

  if (!config.supabaseUrl) {
    errors.push({ field: 'supabaseUrl', message: 'SUPABASE_URL is required' });
  }

  if (!config.supabaseAnonKey) {
    errors.push({ field: 'supabaseAnonKey', message: 'SUPABASE_ANON_KEY is required' });
  }

  // URL validation for SUPABASE_URL
  if (config.supabaseUrl) {
    const urlError = validateUrl(config.supabaseUrl, 'supabaseUrl');
    if (urlError) {
      errors.push(urlError);
    }
  }

  // Numeric range validations
  if (config.complexityThreshold !== undefined) {
    const rangeError = validateNumberRange(
      config.complexityThreshold,
      0,
      1,
      'complexityThreshold'
    );
    if (rangeError) {
      errors.push(rangeError);
    }
  }

  if (config.similarityThreshold !== undefined) {
    const rangeError = validateNumberRange(
      config.similarityThreshold,
      0,
      1,
      'similarityThreshold'
    );
    if (rangeError) {
      errors.push(rangeError);
    }
  }

  if (config.port !== undefined) {
    const portError = validateNumberRange(config.port, 1024, 65535, 'port');
    if (portError) {
      errors.push(portError);
    }
  }

  if (config.cacheSize !== undefined) {
    const cacheError = validateNumberRange(config.cacheSize, 1, 10000, 'cacheSize');
    if (cacheError) {
      errors.push(cacheError);
    }
  }

  if (config.cacheTtlMinutes !== undefined) {
    const ttlError = validateNumberRange(config.cacheTtlMinutes, 1, 10080, 'cacheTtlMinutes');
    if (ttlError) {
      errors.push(ttlError);
    }
  }

  // nodeEnv validation
  if (config.nodeEnv !== undefined) {
    const validEnvs: ReadonlyArray<string> = ['development', 'production', 'test'];
    if (!validEnvs.includes(config.nodeEnv)) {
      errors.push({
        field: 'nodeEnv',
        message: 'NODE_ENV must be one of: development, production, test',
      });
    }
  }

  return errors;
}

/**
 * Validates that a string is a valid URL.
 * Returns null if valid, or a ValidationError if invalid.
 */
export function validateUrl(url: string, fieldName: string): ValidationError | null {
  try {
    new URL(url);
    return null;
  } catch {
    return { field: fieldName, message: `${fieldName} is not a valid URL` };
  }
}

/**
 * Validates that a number falls within the specified range (inclusive).
 * Returns null if valid, or a ValidationError if invalid.
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationError | null {
  if (value < min || value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be between ${min} and ${max}`,
    };
  }
  return null;
}
