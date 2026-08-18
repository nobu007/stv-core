import {
  isDiagramType
} from "./chunk-GW232JDV.js";

// src/utils/guards.ts
function sanitizeFinite(value, defaultValue = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return defaultValue;
}
function sanitizeDiagramType(value, defaultValue = "general") {
  if (isDiagramType(value)) return value;
  return defaultValue;
}
function clampFinite(value, min, max) {
  if (typeof value === "number") {
    if (Number.isFinite(value)) return Math.min(Math.max(value, min), max);
    return value > 0 ? max : min;
  }
  return min;
}
function clamp01(value) {
  return clampFinite(value, 0, 1);
}
function safeToLocaleString(value, defaultValue = "0") {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString();
  return defaultValue;
}

export {
  sanitizeFinite,
  sanitizeDiagramType,
  clampFinite,
  clamp01,
  safeToLocaleString
};
