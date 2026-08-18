import {
  reportCorruption
} from "./chunk-N24QPVFO.js";

// src/utils/safe-storage.ts
function safeLoadFromStorage(key, validate, source, defaultValue) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (storageErr) {
    reportCorruption(source, `localStorage.getItem("${key}") threw: ${String(storageErr)}`);
    return defaultValue;
  }
  if (raw === null) return defaultValue;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    reportCorruption(source, `localStorage "${key}" contained unparseable JSON: ${String(parseErr)}; removing`);
    try {
      localStorage.removeItem(key);
    } catch (removeErr) {
      reportCorruption(source, `localStorage "${key}" could not be removed after parse failure: ${String(removeErr)}`);
    }
    return defaultValue;
  }
  if (validate(parsed)) {
    return parsed;
  }
  reportCorruption(
    source,
    `localStorage "${key}" contained valid JSON but failed type validation; removing`
  );
  try {
    localStorage.removeItem(key);
  } catch (removeErr) {
    reportCorruption(source, `localStorage "${key}" could not be removed after type validation failure: ${String(removeErr)}`);
  }
  return defaultValue;
}
function safeSaveToStorage(key, value, source) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    reportCorruption(source, `localStorage "${key}" could not be serialized; skipping write`);
    return false;
  }
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    reportCorruption(source, `localStorage "${key}" write failed (quota or access denied)`);
    return false;
  }
}
function safeRemoveFromStorage(key, source) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    reportCorruption(source, `localStorage "${key}" remove failed (storage access denied)`);
    return false;
  }
}

export {
  safeLoadFromStorage,
  safeSaveToStorage,
  safeRemoveFromStorage
};
