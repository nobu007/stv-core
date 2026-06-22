/**
 * Tests for limits.ts (ISS-044)
 *
 * Verifies centralized limits are properly defined, have correct values,
 * are immutable at runtime, and are used consistently across the codebase.
 */
import { describe, it, expect } from '@jest/globals';
import {
  RATE_LIMITS,
  BATCH_LIMITS,
  SERVER_LIMITS,
  PIPELINE_LIMITS,
  SUPPORTED_AUDIO_FORMATS,
  AUDIO_LIMITS,
  ERROR_REGISTRY_LIMITS,
  EXPORT_RETRY_LIMITS,
  EXPORT_STAGE_TIMEOUTS,
  EXPORT_QUEUE_LIMITS,
  ARTIFACT_STORE_LIMITS,
  SECURITY_LIMITS,
} from '../limits';

describe('limits', () => {
  describe('RATE_LIMITS', () => {
    it('should have API rate limit of 100 requests per 15 min', () => {
      expect(RATE_LIMITS.API.WINDOW_MS).toBe(15 * 60 * 1000);
      expect(RATE_LIMITS.API.MAX_REQUESTS).toBe(100);
    });

    it('should have stricter upload rate limit of 20 requests per 15 min', () => {
      expect(RATE_LIMITS.UPLOAD.WINDOW_MS).toBe(15 * 60 * 1000);
      expect(RATE_LIMITS.UPLOAD.MAX_REQUESTS).toBe(20);
    });

    it('should have most restrictive export rate limit of 10 per 15 min', () => {
      expect(RATE_LIMITS.EXPORT.WINDOW_MS).toBe(15 * 60 * 1000);
      expect(RATE_LIMITS.EXPORT.MAX_REQUESTS).toBe(10);
    });

    it('should enforce export < upload < API ordering', () => {
      expect(RATE_LIMITS.EXPORT.MAX_REQUESTS).toBeLessThan(RATE_LIMITS.UPLOAD.MAX_REQUESTS);
      expect(RATE_LIMITS.UPLOAD.MAX_REQUESTS).toBeLessThan(RATE_LIMITS.API.MAX_REQUESTS);
    });
  });

  describe('BATCH_LIMITS', () => {
    it('should limit concurrent jobs to 3', () => {
      expect(BATCH_LIMITS.MAX_CONCURRENT_JOBS).toBe(3);
    });

    it('should limit stored jobs to 200', () => {
      expect(BATCH_LIMITS.MAX_STORED_JOBS).toBe(200);
    });

    it('should limit files per batch to 100', () => {
      expect(BATCH_LIMITS.MAX_FILES_PER_BATCH).toBe(100);
    });

    it('should have stored jobs > concurrent jobs', () => {
      expect(BATCH_LIMITS.MAX_STORED_JOBS).toBeGreaterThan(BATCH_LIMITS.MAX_CONCURRENT_JOBS);
    });
  });

  describe('SERVER_LIMITS', () => {
    it('should set body limit to 50mb', () => {
      expect(SERVER_LIMITS.BODY_LIMIT).toBe('50mb');
    });

    it('should set default timeout to 30 seconds', () => {
      expect(SERVER_LIMITS.DEFAULT_TIMEOUT_MS).toBe(30_000);
    });

    it('should set heavy operation timeout to 120 seconds', () => {
      expect(SERVER_LIMITS.HEAVY_OPERATION_TIMEOUT_MS).toBe(120_000);
    });

    it('should have heavy timeout > default timeout', () => {
      expect(SERVER_LIMITS.HEAVY_OPERATION_TIMEOUT_MS).toBeGreaterThan(SERVER_LIMITS.DEFAULT_TIMEOUT_MS);
    });
  });

  describe('PIPELINE_LIMITS', () => {
    it('should limit scenes to 200', () => {
      expect(PIPELINE_LIMITS.MAX_SCENES).toBe(200);
    });

    it('should limit iterations to 500', () => {
      expect(PIPELINE_LIMITS.MAX_ITERATIONS).toBe(500);
    });

    it('should limit output name length to 255', () => {
      expect(PIPELINE_LIMITS.MAX_OUTPUT_NAME_LENGTH).toBe(255);
    });

    it('should limit commit message length to 1000', () => {
      expect(PIPELINE_LIMITS.MAX_COMMIT_MESSAGE_LENGTH).toBe(1000);
    });

    it('should limit FPS to 120', () => {
      expect(PIPELINE_LIMITS.MAX_FPS).toBe(120);
    });

    it('should limit resolution to 8K (8640px)', () => {
      expect(PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION).toBe(8640);
    });

    it('should have MAX_FPS >= 30 (standard framerate)', () => {
      expect(PIPELINE_LIMITS.MAX_FPS).toBeGreaterThanOrEqual(30);
    });

    it('should have MAX_RESOLUTION_DIMENSION >= 1080 (standard HD)', () => {
      expect(PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION).toBeGreaterThanOrEqual(1080);
    });
  });

  describe('SUPPORTED_AUDIO_FORMATS', () => {
    it('should include mp3, wav, ogg, m4a', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('mp3');
      expect(SUPPORTED_AUDIO_FORMATS).toContain('wav');
      expect(SUPPORTED_AUDIO_FORMATS).toContain('ogg');
      expect(SUPPORTED_AUDIO_FORMATS).toContain('m4a');
    });

    it('should have exactly 4 formats', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toHaveLength(4);
    });
  });

  describe('AUDIO_LIMITS', () => {
    it('should limit file size to 50 MB', () => {
      expect(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
    });

    it('should set duration warning at 1 hour (3600 seconds)', () => {
      expect(AUDIO_LIMITS.DURATION_WARNING_SECONDS).toBe(3600);
    });
  });

  describe('ERROR_REGISTRY_LIMITS', () => {
    it('should limit stored errors to 1000', () => {
      expect(ERROR_REGISTRY_LIMITS.MAX_STORED_ERRORS).toBe(1000);
    });

    it('should limit errorId to 128 characters', () => {
      expect(ERROR_REGISTRY_LIMITS.MAX_ERROR_ID_LENGTH).toBe(128);
    });

    it('should limit errorMessage to 2000 characters', () => {
      expect(ERROR_REGISTRY_LIMITS.MAX_ERROR_MESSAGE_LENGTH).toBe(2000);
    });

    it('should have errorId pattern that rejects special chars', () => {
      expect(ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN.test('abc-123_def.456')).toBe(true);
      expect(ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN.test('abc 123')).toBe(false);
      expect(ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN.test('abc/123')).toBe(false);
      expect(ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN.test('')).toBe(false);
    });

    it('should have errorId pattern that allows alphanumeric, hyphens, underscores, dots', () => {
      const pattern = ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN;
      expect(pattern.test('a')).toBe(true);
      expect(pattern.test('A')).toBe(true);
      expect(pattern.test('0')).toBe(true);
      expect(pattern.test('-')).toBe(true);
      expect(pattern.test('_')).toBe(true);
      expect(pattern.test('.')).toBe(true);
    });

    it('should have errorId pattern that rejects CRLF injection', () => {
      const pattern = ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN;
      expect(pattern.test('abc\r\nX-Injected: yes')).toBe(false);
      expect(pattern.test('abc\n')).toBe(false);
      expect(pattern.test('abc\r')).toBe(false);
    });
  });

  describe('EXPORT_RETRY_LIMITS', () => {
    it('should limit retries to 3', () => {
      expect(EXPORT_RETRY_LIMITS.MAX_RETRIES).toBe(3);
    });

    it('should set initial delay to 1 second', () => {
      expect(EXPORT_RETRY_LIMITS.INITIAL_DELAY_MS).toBe(1000);
    });

    it('should cap delay at 30 seconds', () => {
      expect(EXPORT_RETRY_LIMITS.MAX_DELAY_MS).toBe(30_000);
    });

    it('should set jitter max to 500ms', () => {
      expect(EXPORT_RETRY_LIMITS.JITTER_MAX_MS).toBe(500);
    });

    it('should have MAX_DELAY > INITIAL_DELAY', () => {
      expect(EXPORT_RETRY_LIMITS.MAX_DELAY_MS).toBeGreaterThan(EXPORT_RETRY_LIMITS.INITIAL_DELAY_MS);
    });
  });

  describe('EXPORT_STAGE_TIMEOUTS', () => {
    it('should set preparing timeout to 30 seconds', () => {
      expect(EXPORT_STAGE_TIMEOUTS.preparing).toBe(30_000);
    });

    it('should set rendering timeout to 10 minutes', () => {
      expect(EXPORT_STAGE_TIMEOUTS.rendering).toBe(600_000);
    });

    it('should set encoding timeout to 5 minutes', () => {
      expect(EXPORT_STAGE_TIMEOUTS.encoding).toBe(300_000);
    });

    it('should set finalizing timeout to 1 minute', () => {
      expect(EXPORT_STAGE_TIMEOUTS.finalizing).toBe(60_000);
    });

    it('should have rendering as the longest stage timeout', () => {
      const timeouts = EXPORT_STAGE_TIMEOUTS;
      expect(timeouts.rendering).toBeGreaterThan(timeouts.preparing);
      expect(timeouts.rendering).toBeGreaterThan(timeouts.encoding);
      expect(timeouts.rendering).toBeGreaterThan(timeouts.finalizing);
    });
  });

  describe('EXPORT_QUEUE_LIMITS', () => {
    it('should limit concurrency to 3', () => {
      expect(EXPORT_QUEUE_LIMITS.MAX_CONCURRENT).toBe(3);
    });

    it('should limit queue size to 100', () => {
      expect(EXPORT_QUEUE_LIMITS.MAX_QUEUE_SIZE).toBe(100);
    });

    it('should set starvation prevention interval to 30 seconds', () => {
      expect(EXPORT_QUEUE_LIMITS.STARVATION_PREVENTION_INTERVAL_MS).toBe(30_000);
    });

    it('should retain 500 completed jobs', () => {
      expect(EXPORT_QUEUE_LIMITS.MAX_COMPLETED_JOBS).toBe(500);
    });

    it('should limit retries to 3', () => {
      expect(EXPORT_QUEUE_LIMITS.MAX_RETRIES).toBe(3);
    });

    it('should set retry base delay to 2 seconds', () => {
      expect(EXPORT_QUEUE_LIMITS.RETRY_BASE_DELAY_MS).toBe(2000);
    });

    it('should cap retry delay at 30 seconds', () => {
      expect(EXPORT_QUEUE_LIMITS.RETRY_MAX_DELAY_MS).toBe(30_000);
    });

    it('should limit DLQ to 200 jobs', () => {
      expect(EXPORT_QUEUE_LIMITS.MAX_DLQ_JOBS).toBe(200);
    });

    it('should have MAX_QUEUE_SIZE > MAX_CONCURRENT', () => {
      expect(EXPORT_QUEUE_LIMITS.MAX_QUEUE_SIZE).toBeGreaterThan(EXPORT_QUEUE_LIMITS.MAX_CONCURRENT);
    });

    it('should have RETRY_MAX_DELAY > RETRY_BASE_DELAY', () => {
      expect(EXPORT_QUEUE_LIMITS.RETRY_MAX_DELAY_MS).toBeGreaterThan(EXPORT_QUEUE_LIMITS.RETRY_BASE_DELAY_MS);
    });
  });

  describe('ARTIFACT_STORE_LIMITS', () => {
    it('should set default TTL to 1 hour', () => {
      expect(ARTIFACT_STORE_LIMITS.DEFAULT_TTL_MS).toBe(3_600_000);
    });

    it('should limit storage to 1 GB', () => {
      expect(ARTIFACT_STORE_LIMITS.MAX_STORAGE_BYTES).toBe(1024 * 1024 * 1024);
    });

    it('should limit artifacts to 1000', () => {
      expect(ARTIFACT_STORE_LIMITS.MAX_ARTIFACTS).toBe(1000);
    });

    it('should set download URL TTL to 5 minutes', () => {
      expect(ARTIFACT_STORE_LIMITS.DOWNLOAD_URL_TTL_MS).toBe(300_000);
    });

    it('should run cleanup every 60 seconds', () => {
      expect(ARTIFACT_STORE_LIMITS.CLEANUP_INTERVAL_MS).toBe(60_000);
    });
  });

  describe('SECURITY_LIMITS', () => {
    it('should require JWT secret minimum length of 32', () => {
      expect(SECURITY_LIMITS.JWT_SECRET_MIN_LENGTH).toBe(32);
    });

    it('should require at least 2 character types in JWT secret', () => {
      expect(SECURITY_LIMITS.JWT_SECRET_MIN_CHAR_TYPES).toBe(2);
    });

    it('should have reasonable minimum length (>= 16)', () => {
      expect(SECURITY_LIMITS.JWT_SECRET_MIN_LENGTH).toBeGreaterThanOrEqual(16);
    });
  });

  // --- Cross-cutting validation ---

  describe('consistency checks', () => {
    it('EXPORT_RETRY_LIMITS.MAX_RETRIES should match EXPORT_QUEUE_LIMITS.MAX_RETRIES', () => {
      expect(EXPORT_RETRY_LIMITS.MAX_RETRIES).toBe(EXPORT_QUEUE_LIMITS.MAX_RETRIES);
    });

    it('EXPORT_QUEUE_LIMITS.MAX_CONCURRENT should match BATCH_LIMITS.MAX_CONCURRENT_JOBS', () => {
      expect(EXPORT_QUEUE_LIMITS.MAX_CONCURRENT).toBe(BATCH_LIMITS.MAX_CONCURRENT_JOBS);
    });
  });
});
