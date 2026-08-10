/**
 * Format a playback position or duration (in seconds) as a compact clock
 * string `m:ss` (e.g. 65 → "1:05"). Shared by the video-preview components.
 *
 * Guards against non-finite / negative values. HTMLMediaElement exposes
 * `duration === NaN` for media whose duration is unknown even after the
 * `loadedmetadata` event (and `currentTime` can transiently be NaN during
 * seeking on some browsers). Without this guard the display reads "NaN:NaN"
 * / "Infinity:NaN". The guard mirrors `formatDuration` in `audio-duration.ts`.
 *
 * Flooring (never rounding) the seconds field means a value like 59.9 renders
 * "0:59", never the impossible "0:60" — see the round-then-decompose class.
 */
export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
