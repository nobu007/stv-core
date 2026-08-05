/**
 * Safe localStorage deserialization with built-in corruption observability.
 *
 * Wraps the common pattern:
 *   1. localStorage.getItem(key)
 *   2. JSON.parse(value)
 *   3. Type-guard validation
 *   4. On any failure: reportCorruption + removeItem + return default
 *
 * Future callers should use this instead of hand-rolling try/catch +
 * console.warn at each location.
 */

import { reportCorruption } from './report-corruption';

/**
 * Load and validate a JSON-serialisable value from localStorage.
 *
 * @param key         localStorage key
 * @param validate    Type-guard function; return `true` if the parsed value is safe
 * @param source      Logical source identifier for corruption reports
 * @param defaultValue Value returned on any failure (default: `null`)
 * @returns           The validated value, or `defaultValue` on failure
 */
export function safeLoadFromStorage<T>(
  key: string,
  validate: (parsed: unknown) => parsed is T,
  source: string,
  defaultValue: T,
): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (storageErr) {
    // localStorage itself may throw (private mode, quota, etc.)
    reportCorruption(source, `localStorage.getItem("${key}") threw: ${String(storageErr)}`);
    return defaultValue;
  }

  if (raw === null) return defaultValue;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    reportCorruption(source, `localStorage "${key}" contained unparseable JSON: ${String(parseErr)}; removing`);
    try { localStorage.removeItem(key); } catch (removeErr) {
      reportCorruption(source, `localStorage "${key}" could not be removed after parse failure: ${String(removeErr)}`);
    }
    return defaultValue;
  }

  if (validate(parsed)) {
    return parsed;
  }

  reportCorruption(
    source,
    `localStorage "${key}" contained valid JSON but failed type validation; removing`,
  );
  try { localStorage.removeItem(key); } catch (removeErr) {
    reportCorruption(source, `localStorage "${key}" could not be removed after type validation failure: ${String(removeErr)}`);
  }
  return defaultValue;
}

/**
 * Safely serialize and persist a value to localStorage.
 *
 * Wraps the common pattern:
 *   1. JSON.stringify(value)
 *   2. localStorage.setItem(key, serialized)
 *   3. On any failure: reportCorruption + return false
 *
 * @param key     localStorage key
 * @param value   Value to serialize and store
 * @param source  Logical source identifier for corruption reports
 * @returns       `true` on success, `false` on failure
 */
export function safeSaveToStorage(
  key: string,
  value: unknown,
  source: string,
): boolean {
  let serialized: string;
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
    // localStorage may throw (private mode, quota exceeded, etc.)
    reportCorruption(source, `localStorage "${key}" write failed (quota or access denied)`);
    return false;
  }
}
