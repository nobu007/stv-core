/**
 * Utility for measuring audio file duration client-side.
 * Uses the HTMLAudioElement loadedmetadata event to avoid decoding the full buffer.
 */
/**
 * Resolve the duration (in seconds) of an audio File object.
 *
 * Works in browser contexts where the Audio element is available.
 * Returns Infinity for streaming formats that don't expose duration upfront.
 */
export declare function getAudioDuration(file: File): Promise<number>;
/**
 * Format a duration in seconds to a human-readable string (e.g. "1h 23m").
 */
export declare function formatDuration(seconds: number): string;
