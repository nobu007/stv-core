/**
 * ISS-044: Centralized application limits and thresholds.
 *
 * All magic numbers that govern rate limiting, job concurrency,
 * body sizes, and file counts are defined here so they can be
 * reviewed, overridden, and tested in one place.
 */

/** Rate limiting configuration */
export const RATE_LIMITS = {
  /** Global API rate limit */
  API: {
    /** Window duration in milliseconds */
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    /** Maximum requests per window per IP */
    MAX_REQUESTS: 100,
  },
  /** Upload / batch-job-creation rate limit */
  UPLOAD: {
    /** Window duration in milliseconds */
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    /** Maximum requests per window per IP */
    MAX_REQUESTS: 20,
  },
} as const;

/** Batch processing limits */
export const BATCH_LIMITS = {
  /** Maximum number of concurrent batch jobs */
  MAX_CONCURRENT_JOBS: 3,
  /** Maximum number of jobs stored in memory before pruning */
  MAX_STORED_JOBS: 200,
  /** Maximum number of files per batch request */
  MAX_FILES_PER_BATCH: 100,
} as const;

/** HTTP server limits */
export const SERVER_LIMITS = {
  /** Maximum JSON body size */
  BODY_LIMIT: '50mb',
} as const;

/** Pipeline validation limits (previously scattered as magic numbers in pipeline.ts) */
export const PIPELINE_LIMITS = {
  /** Maximum number of scenes per render request */
  MAX_SCENES: 200,
  /** Maximum stored iterations before compaction */
  MAX_ITERATIONS: 500,
  /** Maximum output filename length */
  MAX_OUTPUT_NAME_LENGTH: 255,
  /** Maximum commit message length */
  MAX_COMMIT_MESSAGE_LENGTH: 1000,
  /** Maximum allowed FPS value */
  MAX_FPS: 120,
} as const;

/** Audio file processing limits */
export const AUDIO_LIMITS = {
  /** Maximum file size in bytes (50 MB) */
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  /** Duration threshold (seconds) above which a pre-processing warning is shown (EDGE-103) */
  DURATION_WARNING_SECONDS: 3600,
} as const;

/** Security-related minimum requirements */
export const SECURITY_LIMITS = {
  /** Minimum JWT secret length */
  JWT_SECRET_MIN_LENGTH: 32,
  /** Minimum unique character types in JWT secret (uppercase, lowercase, digit, special) */
  JWT_SECRET_MIN_CHAR_TYPES: 2,
} as const;
