/**
 * ISS-044: Centralized application limits and thresholds.
 *
 * All magic numbers that govern rate limiting, job concurrency,
 * body sizes, and file counts are defined here so they can be
 * reviewed, overridden, and tested in one place.
 */
/** Rate limiting configuration */
export declare const RATE_LIMITS: {
    /** Global API rate limit */
    readonly API: {
        /** Window duration in milliseconds */
        readonly WINDOW_MS: number;
        /** Maximum requests per window per IP */
        readonly MAX_REQUESTS: 100;
    };
    /** Upload / batch-job-creation rate limit */
    readonly UPLOAD: {
        /** Window duration in milliseconds */
        readonly WINDOW_MS: number;
        /** Maximum requests per window per IP */
        readonly MAX_REQUESTS: 20;
    };
    /** Export / render rate limit — protects expensive CPU-bound operations */
    readonly EXPORT: {
        /** Window duration in milliseconds */
        readonly WINDOW_MS: number;
        /** Maximum render requests per window per IP */
        readonly MAX_REQUESTS: 10;
    };
};
/** Batch processing limits */
export declare const BATCH_LIMITS: {
    /** Maximum number of concurrent batch jobs */
    readonly MAX_CONCURRENT_JOBS: 3;
    /** Maximum number of jobs stored in memory before pruning */
    readonly MAX_STORED_JOBS: 200;
    /** Maximum number of files per batch request */
    readonly MAX_FILES_PER_BATCH: 100;
};
/** HTTP server limits */
export declare const SERVER_LIMITS: {
    /** Maximum JSON body size */
    readonly BODY_LIMIT: "50mb";
    /** Default request timeout in milliseconds */
    readonly DEFAULT_TIMEOUT_MS: 30000;
    /** Timeout for expensive operations (render, batch) in milliseconds */
    readonly HEAVY_OPERATION_TIMEOUT_MS: 120000;
};
/** Pipeline validation limits (previously scattered as magic numbers in pipeline.ts) */
export declare const PIPELINE_LIMITS: {
    /** Maximum number of scenes per render request */
    readonly MAX_SCENES: 200;
    /** Maximum stored iterations before compaction */
    readonly MAX_ITERATIONS: 500;
    /** Maximum output filename length */
    readonly MAX_OUTPUT_NAME_LENGTH: 255;
    /** Maximum commit message length */
    readonly MAX_COMMIT_MESSAGE_LENGTH: 1000;
    /** Maximum allowed FPS value */
    readonly MAX_FPS: 120;
    /** Maximum resolution dimension (width or height in pixels) — prevents resource exhaustion */
    readonly MAX_RESOLUTION_DIMENSION: 8640;
};
/** Supported audio file formats for transcription */
export declare const SUPPORTED_AUDIO_FORMATS: readonly ["mp3", "wav", "ogg", "m4a"];
export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];
/** Audio file processing limits */
export declare const AUDIO_LIMITS: {
    /** Maximum file size in bytes (50 MB) */
    readonly MAX_FILE_SIZE_BYTES: number;
    /** Duration threshold (seconds) above which a pre-processing warning is shown (EDGE-103) */
    readonly DURATION_WARNING_SECONDS: 3600;
};
/** Error registry limits (in-memory error recovery store) */
export declare const ERROR_REGISTRY_LIMITS: {
    /** Maximum number of errors stored before oldest are evicted */
    readonly MAX_STORED_ERRORS: 1000;
    /** Maximum errorId length in characters */
    readonly MAX_ERROR_ID_LENGTH: 128;
    /** Maximum errorMessage length in characters */
    readonly MAX_ERROR_MESSAGE_LENGTH: 2000;
    /** Allowed characters in errorId: alphanumeric, hyphens, underscores, dots */
    readonly ERROR_ID_PATTERN: RegExp;
};
/** Export retry configuration (REQ-227) */
export declare const EXPORT_RETRY_LIMITS: {
    /** Maximum retry attempts for transient encoding errors */
    readonly MAX_RETRIES: 3;
    /** Initial delay in ms before the first retry */
    readonly INITIAL_DELAY_MS: 1000;
    /** Maximum delay between retries in ms */
    readonly MAX_DELAY_MS: 30000;
    /** Jitter range in ms (0–JITTER_MAX_MS added to each delay) */
    readonly JITTER_MAX_MS: 500;
};
/** Export stages that have timeout configuration */
export type ExportTimeoutStage = 'preparing' | 'rendering' | 'encoding' | 'finalizing';
/** Export stage timeout configuration in ms (REQ-228) */
export declare const EXPORT_STAGE_TIMEOUTS: Record<ExportTimeoutStage, number>;
/** Export job queue limits (REQ-229) */
export declare const EXPORT_QUEUE_LIMITS: {
    /** Maximum number of concurrent export jobs processed by the queue */
    readonly MAX_CONCURRENT: 3;
    /** Maximum number of jobs that can be waiting in the queue */
    readonly MAX_QUEUE_SIZE: 100;
    /** Interval in ms at which the oldest low-priority job is promoted to prevent starvation */
    readonly STARVATION_PREVENTION_INTERVAL_MS: 30000;
    /** Maximum number of terminal (completed/failed/cancelled) jobs retained for status lookups */
    readonly MAX_COMPLETED_JOBS: 500;
    /** Maximum retry attempts before a failed job is moved to the dead letter queue */
    readonly MAX_RETRIES: 3;
    /** Base delay in ms for exponential backoff between retries */
    readonly RETRY_BASE_DELAY_MS: 2000;
    /** Maximum delay in ms between retries (backoff cap) */
    readonly RETRY_MAX_DELAY_MS: 30000;
    /** Maximum number of jobs retained in the dead letter queue */
    readonly MAX_DLQ_JOBS: 200;
};
/** Export artifact store limits (REQ-230) */
export declare const ARTIFACT_STORE_LIMITS: {
    /** Default artifact TTL in ms (1 hour) */
    readonly DEFAULT_TTL_MS: 3600000;
    /** Maximum total storage in bytes (1 GB) */
    readonly MAX_STORAGE_BYTES: number;
    /** Maximum number of stored artifacts */
    readonly MAX_ARTIFACTS: 1000;
    /** Download URL validity in ms (5 minutes) */
    readonly DOWNLOAD_URL_TTL_MS: 300000;
    /** Interval in ms for periodic TTL cleanup */
    readonly CLEANUP_INTERVAL_MS: 60000;
};
/** Security-related minimum requirements */
export declare const SECURITY_LIMITS: {
    /** Minimum JWT secret length */
    readonly JWT_SECRET_MIN_LENGTH: 32;
    /** Minimum unique character types in JWT secret (uppercase, lowercase, digit, special) */
    readonly JWT_SECRET_MIN_CHAR_TYPES: 2;
};
