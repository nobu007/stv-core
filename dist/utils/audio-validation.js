import {
  AUDIO_LIMITS,
  SUPPORTED_AUDIO_FORMATS
} from "../chunk-DIBTSNJJ.js";

// src/utils/audio-validation.ts
var MIN_AUDIO_DURATION_SECONDS = 1;
function validateAudioFile(file) {
  const errors = [];
  const warnings = [];
  if (file.size === 0) {
    errors.push("Audio file is empty (0 bytes)");
  }
  if (file.size > AUDIO_LIMITS.MAX_FILE_SIZE_BYTES) {
    errors.push(
      `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum allowed size ${(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`
    );
  }
  const validTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/ogg",
    "audio/x-ogg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm"
  ];
  const validExtensions = [...SUPPORTED_AUDIO_FORMATS, "webm"];
  const ext = file.name.split(".").pop()?.toLowerCase();
  const typeValid = validTypes.some((t) => file.type === t) || (file.type?.startsWith("audio/") ?? false);
  const extValid = ext !== void 0 && validExtensions.includes(ext);
  if (!typeValid && !extValid) {
    errors.push(
      `Unsupported audio file: "${file.name}" (type: ${file.type || "unknown"}). Supported formats: ${validExtensions.join(", ")}`
    );
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
function validateAudioDuration(durationSeconds) {
  const errors = [];
  const warnings = [];
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    errors.push(`Invalid audio duration: ${durationSeconds}`);
    return { valid: false, errors, warnings };
  }
  if (durationSeconds < MIN_AUDIO_DURATION_SECONDS) {
    errors.push(
      `Audio duration ${durationSeconds.toFixed(2)}s is below minimum ${MIN_AUDIO_DURATION_SECONDS}s`
    );
  }
  if (durationSeconds > AUDIO_LIMITS.DURATION_WARNING_SECONDS) {
    warnings.push(
      `Audio duration ${(durationSeconds / 60).toFixed(0)}min exceeds recommended maximum of ${Math.floor(AUDIO_LIMITS.DURATION_WARNING_SECONDS / 60)}min; processing may take longer`
    );
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
function validateAudioFileMetadata(meta) {
  const errors = [];
  const warnings = [];
  const lastDot = meta.name.lastIndexOf(".");
  const ext = lastDot > 0 ? meta.name.slice(lastDot + 1).toLowerCase() : void 0;
  if (!SUPPORTED_AUDIO_FORMATS.includes(ext)) {
    errors.push(
      `Unsupported audio format: "${meta.name}" (extension: ${ext ?? "none"}). Supported: ${SUPPORTED_AUDIO_FORMATS.join(", ")}`
    );
  }
  if (meta.size !== void 0) {
    if (!Number.isFinite(meta.size) || meta.size < 0) {
      errors.push(`Invalid file size for "${meta.name}": ${meta.size}`);
    } else if (meta.size === 0) {
      errors.push(`Audio file "${meta.name}" is empty (0 bytes)`);
    } else if (meta.size > AUDIO_LIMITS.MAX_FILE_SIZE_BYTES) {
      errors.push(
        `File "${meta.name}" size ${(meta.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum ${(AUDIO_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`
      );
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
export {
  MIN_AUDIO_DURATION_SECONDS,
  validateAudioDuration,
  validateAudioFile,
  validateAudioFileMetadata
};
