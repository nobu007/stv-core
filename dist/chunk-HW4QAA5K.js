// src/types/pipeline.ts
var PROCESSING_STATUSES = [
  "idle",
  "uploading",
  "transcribing",
  "analyzing",
  "generating",
  "complete",
  "error"
];
function isProcessingStatus(value) {
  return typeof value === "string" && PROCESSING_STATUSES.includes(value);
}

export {
  isProcessingStatus
};
