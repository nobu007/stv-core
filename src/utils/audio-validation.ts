/**
 * REQ-142: Pipeline-level audio input validation.
 *
 * Validates file size (EDGE-101) and minimum duration (EDGE-102)
 * using the centralized AUDIO_LIMITS configuration.
 * Works with File objects (browser) and requires no DOM for size checks.
 */

import { AUDIO_LIMITS } from '@/config/limits';

/** Minimum duration in seconds below which audio is rejected (EDGE-102) */
export const MIN_AUDIO_DURATION_SECONDS = 1;

export interface AudioValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a File object against audio limits.
 * Checks: empty file, file size (EDGE-101), and file type.
 * Duration validation requires browser APIs and is handled separately
 * via AudioPreprocessor.validateDuration() or getAudioDuration().
 */
export function validateAudioFile(file: File): AudioValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Empty file check
  if (file.size === 0) {
    errors.push('Audio file is empty (0 bytes)');
  }

  // File size limit (EDGE-101)
  if (file.size > AUDIO_LIMITS.MAX_FILE_SIZE_BYTES) {
    errors.push(
      `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum allowed size ${(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`,
    );
  }

  // File type check
  const validTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave',
    'audio/ogg', 'audio/x-ogg', 'audio/mp4', 'audio/x-m4a',
    'audio/webm',
  ];
  const validExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'webm'];
  const ext = file.name.split('.').pop()?.toLowerCase();

  const typeValid = validTypes.some(t => file.type === t) || file.type.startsWith('audio/');
  const extValid = ext !== undefined && validExtensions.includes(ext);

  if (!typeValid && !extValid) {
    errors.push(
      `Unsupported audio file: "${file.name}" (type: ${file.type || 'unknown'}). Supported formats: ${validExtensions.join(', ')}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate audio duration in seconds against limits.
 * EDGE-102: Reject audio shorter than MIN_AUDIO_DURATION_SECONDS.
 * EDGE-103: Warn for audio longer than DURATION_WARNING_SECONDS.
 */
export function validateAudioDuration(durationSeconds: number): AudioValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    errors.push(`Invalid audio duration: ${durationSeconds}`);
    return { valid: false, errors, warnings };
  }

  // EDGE-102: Minimum duration check
  if (durationSeconds < MIN_AUDIO_DURATION_SECONDS) {
    errors.push(
      `Audio duration ${durationSeconds.toFixed(2)}s is below minimum ${MIN_AUDIO_DURATION_SECONDS}s`,
    );
  }

  // EDGE-103: Duration warning for long audio
  if (durationSeconds > AUDIO_LIMITS.DURATION_WARNING_SECONDS) {
    warnings.push(
      `Audio duration ${(durationSeconds / 60).toFixed(0)}min exceeds recommended maximum of ${Math.floor(AUDIO_LIMITS.DURATION_WARNING_SECONDS / 60)}min; processing may take longer`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
