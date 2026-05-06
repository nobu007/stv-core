import type { ConfigSchema } from './schema';
import { SECURITY_LIMITS } from './limits';

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

/**
 * ISS-045: Validates JWT secret complexity.
 * Checks minimum length and that the secret uses at least N distinct character types
 * (uppercase, lowercase, digit, special).
 * Returns an array of warnings (not fatal — the server can still start in dev).
 */
export function validateJwtSecret(secret: string): ValidationError[] {
  const warnings: ValidationError[] = [];

  if (secret.length < SECURITY_LIMITS.JWT_SECRET_MIN_LENGTH) {
    warnings.push({
      field: 'JWT_SECRET',
      message: `JWT_SECRET should be at least ${SECURITY_LIMITS.JWT_SECRET_MIN_LENGTH} characters for adequate security (current: ${secret.length})`,
    });
  }

  const charTypes = [
    /[A-Z]/.test(secret),    // uppercase
    /[a-z]/.test(secret),    // lowercase
    /[0-9]/.test(secret),    // digit
    /[^A-Za-z0-9]/.test(secret), // special
  ].filter(Boolean).length;

  if (charTypes < SECURITY_LIMITS.JWT_SECRET_MIN_CHAR_TYPES) {
    warnings.push({
      field: 'JWT_SECRET',
      message: `JWT_SECRET should use at least ${SECURITY_LIMITS.JWT_SECRET_MIN_CHAR_TYPES} character types (uppercase, lowercase, digit, special) for adequate complexity`,
    });
  }

  return warnings;
}

/**
 * ISS-045: Validates CORS_ORIGINS format.
 * Each comma-separated value must be a valid URL with http or https protocol.
 * Returns an array of errors.
 */
export function validateCorsOrigins(origins: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const parts = origins.split(',').map(o => o.trim()).filter(Boolean);

  for (const origin of parts) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.push({
          field: 'CORS_ORIGINS',
          message: `CORS origin "${origin}" must use http: or https: protocol, got ${url.protocol}`,
        });
      }
    } catch {
      errors.push({
        field: 'CORS_ORIGINS',
        message: `CORS origin "${origin}" is not a valid URL`,
      });
    }
  }

  return errors;
}

/**
 * ISS-045: Validates environment variables that are not part of ConfigSchema
 * but are still critical for secure operation (JWT_SECRET, CORS_ORIGINS).
 *
 * Returns warnings (non-fatal) and errors (fatal in production).
 * In non-production environments, issues are logged as warnings only.
 */
export function validateSecurityEnv(): { warnings: ValidationError[]; errors: ValidationError[] } {
  const warnings: ValidationError[] = [];
  const errors: ValidationError[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // JWT_SECRET validation
  const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    const jwtWarnings = validateJwtSecret(jwtSecret);
    if (isProduction && jwtWarnings.length > 0) {
      errors.push(...jwtWarnings);
    } else {
      warnings.push(...jwtWarnings);
    }
  } else if (isProduction) {
    errors.push({
      field: 'JWT_SECRET',
      message: 'JWT_SECRET or SUPABASE_JWT_SECRET is required in production',
    });
  }

  // CORS_ORIGINS validation
  const corsOrigins = process.env.CORS_ORIGINS;
  if (corsOrigins) {
    const corsErrors = validateCorsOrigins(corsOrigins);
    if (isProduction && corsErrors.length > 0) {
      errors.push(...corsErrors);
    } else {
      warnings.push(...corsErrors);
    }
  }

  return { warnings, errors };
}
