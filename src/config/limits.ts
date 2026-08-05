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
  /** Export / render rate limit — protects expensive CPU-bound operations */
  EXPORT: {
    /** Window duration in milliseconds */
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    /** Maximum render requests per window per IP */
    MAX_REQUESTS: 10,
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
  /** Default request timeout in milliseconds */
  DEFAULT_TIMEOUT_MS: 30_000,
  /** Timeout for expensive operations (render, batch) in milliseconds */
  HEAVY_OPERATION_TIMEOUT_MS: 120_000,
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
  /** Maximum resolution dimension (width or height in pixels) — prevents resource exhaustion */
  MAX_RESOLUTION_DIMENSION: 8640, // 8K
} as const;

/** Supported audio file formats for transcription */
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a'] as const;
export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];

/** Audio file processing limits */
export const AUDIO_LIMITS = {
  /** Maximum file size in bytes (50 MB) */
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  /** Duration threshold (seconds) above which a pre-processing warning is shown (EDGE-103) */
  DURATION_WARNING_SECONDS: 3600,
} as const;

/** Error registry limits (in-memory error recovery store) */
export const ERROR_REGISTRY_LIMITS = {
  /** Maximum number of errors stored before oldest are evicted */
  MAX_STORED_ERRORS: 1000,
  /** Maximum errorId length in characters */
  MAX_ERROR_ID_LENGTH: 128,
  /** Maximum errorMessage length in characters */
  MAX_ERROR_MESSAGE_LENGTH: 2000,
  /** Allowed characters in errorId: alphanumeric, hyphens, underscores, dots */
  ERROR_ID_PATTERN: /^[a-zA-Z0-9._-]+$/,
} as const;

/** Export retry configuration (REQ-227) */
export const EXPORT_RETRY_LIMITS = {
  /** Maximum retry attempts for transient encoding errors */
  MAX_RETRIES: 3,
  /** Initial delay in ms before the first retry */
  INITIAL_DELAY_MS: 1000,
  /** Maximum delay between retries in ms */
  MAX_DELAY_MS: 30_000,
  /** Jitter range in ms (0–JITTER_MAX_MS added to each delay) */
  JITTER_MAX_MS: 500,
} as const;

/** Export stages that have timeout configuration */
export type ExportTimeoutStage = 'preparing' | 'rendering' | 'encoding' | 'finalizing';

/** Export stage timeout configuration in ms (REQ-228) */
export const EXPORT_STAGE_TIMEOUTS: Record<ExportTimeoutStage, number> = {
  /** Preparing stage timeout (scene validation, codec setup) */
  preparing: 30_000,
  /** Rendering stage timeout (frame generation) */
  rendering: 600_000,
  /** Encoding stage timeout (format-specific encoding) */
  encoding: 300_000,
  /** Finalizing stage timeout (verification, file write) */
  finalizing: 60_000,
};

/** Export job queue limits (REQ-229) */
export const EXPORT_QUEUE_LIMITS = {
  /** Maximum number of concurrent export jobs processed by the queue */
  MAX_CONCURRENT: 3,
  /** Maximum number of jobs that can be waiting in the queue */
  MAX_QUEUE_SIZE: 100,
  /** Interval in ms at which the oldest low-priority job is promoted to prevent starvation */
  STARVATION_PREVENTION_INTERVAL_MS: 30_000,
  /** Maximum number of terminal (completed/failed/cancelled) jobs retained for status lookups */
  MAX_COMPLETED_JOBS: 500,
  /** Maximum retry attempts before a failed job is moved to the dead letter queue */
  MAX_RETRIES: 3,
  /** Base delay in ms for exponential backoff between retries */
  RETRY_BASE_DELAY_MS: 2_000,
  /** Maximum delay in ms between retries (backoff cap) */
  RETRY_MAX_DELAY_MS: 30_000,
  /** Maximum number of jobs retained in the dead letter queue */
  MAX_DLQ_JOBS: 200,
} as const;

/** Export artifact store limits (REQ-230) */
export const ARTIFACT_STORE_LIMITS = {
  /** Default artifact TTL in ms (1 hour) */
  DEFAULT_TTL_MS: 3_600_000,
  /** Maximum total storage in bytes (1 GB) */
  MAX_STORAGE_BYTES: 1024 * 1024 * 1024,
  /** Maximum number of stored artifacts */
  MAX_ARTIFACTS: 1000,
  /** Download URL validity in ms (5 minutes) */
  DOWNLOAD_URL_TTL_MS: 300_000,
  /** Interval in ms for periodic TTL cleanup */
  CLEANUP_INTERVAL_MS: 60_000,
} as const;

/** Security-related minimum requirements */
export const SECURITY_LIMITS = {
  /** Minimum JWT secret length */
  JWT_SECRET_MIN_LENGTH: 32,
  /** Minimum unique character types in JWT secret (uppercase, lowercase, digit, special) */
  JWT_SECRET_MIN_CHAR_TYPES: 2,
} as const;
