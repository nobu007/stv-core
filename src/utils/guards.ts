/**
 * Runtime guard functions for diagram detection results.
 *
 * These helpers prevent NaN/Infinity propagation and invalid type values
 * from leaking into layout engines, quality gates, and scene generation.
 *
 * The inline `Number.isFinite()` / `isDiagramType()` patterns that were
 * scattered across diagram-detector consensus code and pipeline consumers
 * are consolidated here so future code can't reintroduce unguarded access.
 */

import { DiagramType, isDiagramType } from '@/types/diagram';

/**
 * Return `value` when it is a finite number, otherwise `defaultValue`.
 *
 * Guards against NaN, ±Infinity, and non-number values that would corrupt
 * downstream calculations (confidence averaging, score comparison, etc.).
 *
 * ```ts
 * sanitizeFinite(0.85);           // → 0.85
 * sanitizeFinite(NaN);            // → 0
 * sanitizeFinite(Infinity);       // → 0
 * sanitizeFinite(NaN, 0.5);       // → 0.5
 * sanitizeFinite('oops' as unknown as number); // → 0
 * ```
 */
export function sanitizeFinite(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return defaultValue;
}

/**
 * Return `value` when it is a valid `DiagramType`, otherwise `defaultValue`.
 *
 * Prevents invalid string types from reaching layout engines that switch
 * on diagram type. Empty strings, undefined, and arbitrary strings are
 * all safely caught.
 *
 * ```ts
 * sanitizeDiagramType('flow');             // → 'flow'
 * sanitizeDiagramType('');                 // → 'general'
 * sanitizeDiagramType(undefined);          // → 'general'
 * sanitizeDiagramType('invalid' as DiagramType); // → 'general'
 * ```
 */
export function sanitizeDiagramType(value: unknown, defaultValue: DiagramType = 'general'): DiagramType {
  if (isDiagramType(value)) return value;
  return defaultValue;
}

/**
 * Clamp a numeric value to the range [min, max] with NaN→min fallback.
 *
 * Useful for confidence values that must stay in [0, 1].
 *
 * ```ts
 * clampFinite(0.85, 0, 1);   // → 0.85
 * clampFinite(NaN, 0, 1);    // → 0
 * clampFinite(1.5, 0, 1);    // → 1
 * clampFinite(-0.3, 0, 1);   // → 0
 * ```
 */
export function clampFinite(value: unknown, min: number, max: number): number {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return Math.min(Math.max(value, min), max);
    // +Infinity → max, -Infinity → min, NaN → min
    return value > 0 ? max : min;
  }
  return min;
}

/**
 * Clamp a number to the canonical [0, 1] confidence/score range.
 *
 * This is the single source of truth for `Math.max(0, Math.min(1, x))`, which
 * was previously inlined — verbatim — at eight sites (llm-service,
 * semantic-similarity ×2, layout-quality-composite ×2, enhanced-zero-overlap,
 * LayoutEvaluator, importance-scaler, intelligent-cache) plus a private
 * `clamp01` on the quality monitor. Delegating to {@link clampFinite} keeps the
 * EXACT behavior the inline copies had for every finite and ±Infinity input:
 * `+Infinity → 1`, `-Infinity → 0`, and in-range values unchanged. The one
 * deliberate improvement is `NaN → 0`: a bare `Math.max(0, Math.min(1, NaN))`
 * returns `NaN` (NaN propagates through both Math calls), so a NaN
 * confidence/score previously leaked downstream; here it is sanitized to 0.
 *
 * ```ts
 * clamp01(0.85);       // → 0.85
 * clamp01(1.5);        // → 1
 * clamp01(-0.3);       // → 0
 * clamp01(NaN);        // → 0  (bare Math.max/min would return NaN)
 * clamp01(Infinity);   // → 1
 * clamp01(-Infinity);  // → 0
 * ```
 */
export function clamp01(value: number): number {
  return clampFinite(value, 0, 1);
}

/**
 * Safely call `.toLocaleString()` on a value that might be null/undefined/NaN.
 *
 * Returns `'0'` (or `defaultValue`) when the input is not a finite number,
 * preventing `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`.
 *
 * ```ts
 * safeToLocaleString(12345);        // → '12,345'
 * safeToLocaleString(undefined);    // → '0'
 * safeToLocaleString(NaN);          // → '0'
 * safeToLocaleString(null, '—');    // → '—'
 * ```
 */
export function safeToLocaleString(value: unknown, defaultValue: string = '0'): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString();
  return defaultValue;
}
