/**
 * REQ-142: Pipeline-level audio input validation.
 *
 * Validates file size (EDGE-101) and minimum duration (EDGE-102)
 * using the centralized AUDIO_LIMITS configuration.
 * Works with File objects (browser) and requires no DOM for size checks.
 * REQ-148: Server-side audio metadata validation for API boundary.
 */
/** Minimum duration in seconds below which audio is rejected (EDGE-102) */
export declare const MIN_AUDIO_DURATION_SECONDS = 1;
export interface AudioValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/** Input for server-side audio validation (no File dependency) */
export interface AudioFileMetadata {
    /** Original filename (e.g. "speech.mp3") */
    name: string;
    /** File size in bytes; 0 or omitted means "unknown" */
    size?: number;
}
/**
 * Validate a File object against audio limits.
 * Checks: empty file, file size (EDGE-101), and file type.
 * Duration validation requires browser APIs and is handled separately
 * via AudioPreprocessor.validateDuration() or getAudioDuration().
 */
export declare function validateAudioFile(file: File): AudioValidationResult;
/**
 * Validate audio duration in seconds against limits.
 * EDGE-102: Reject audio shorter than MIN_AUDIO_DURATION_SECONDS.
 * EDGE-103: Warn for audio longer than DURATION_WARNING_SECONDS.
 */
export declare function validateAudioDuration(durationSeconds: number): AudioValidationResult;
/**
 * REQ-148: Validate audio file metadata on the server side (no File object needed).
 *
 * Checks filename extension against SUPPORTED_AUDIO_FORMATS and optional
 * file size against AUDIO_LIMITS.MAX_FILE_SIZE_BYTES.
 * Used at the API boundary to reject invalid audio before pipeline processing.
 */
export declare function validateAudioFileMetadata(meta: AudioFileMetadata): AudioValidationResult;
