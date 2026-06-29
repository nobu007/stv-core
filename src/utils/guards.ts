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
  const v = sanitizeFinite(value, min);
  return Math.min(Math.max(v, min), max);
}
