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
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(url);

    audio.addEventListener(
      'loadedmetadata',
      () => {
        cleanup();
        resolve(audio.duration);
      },
      { once: true },
    );

    audio.addEventListener(
      'error',
      () => {
        cleanup();
        reject(new Error(`Failed to load audio metadata for ${file.name}`));
      },
      { once: true },
    );

    // Preload metadata only — avoids downloading the full file
    audio.preload = 'metadata';
    audio.src = url;
  });
}

/**
 * Format a duration in seconds to a human-readable string (e.g. "1h 23m").
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '不明';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return s > 0 ? `${h}時間${m}分${s}秒` : m > 0 ? `${h}時間${m}分` : `${h}時間`;
  }
  if (m > 0) {
    return s > 0 ? `${m}分${s}秒` : `${m}分`;
  }
  return `${s}秒`;
}
