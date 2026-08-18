// src/utils/audio-duration.ts
function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener(
      "loadedmetadata",
      () => {
        cleanup();
        resolve(audio.duration);
      },
      { once: true }
    );
    audio.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error(`Failed to load audio metadata for ${file.name}`));
      },
      { once: true }
    );
    audio.preload = "metadata";
    audio.src = url;
  });
}
function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "\u4E0D\u660E";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return s > 0 ? `${h}\u6642\u9593${m}\u5206${s}\u79D2` : m > 0 ? `${h}\u6642\u9593${m}\u5206` : `${h}\u6642\u9593`;
  }
  if (m > 0) {
    return s > 0 ? `${m}\u5206${s}\u79D2` : `${m}\u5206`;
  }
  return `${s}\u79D2`;
}
export {
  formatDuration,
  getAudioDuration
};
