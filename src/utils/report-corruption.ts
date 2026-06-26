/**
 * Centralized corruption-reporting utility.
 *
 * Provides a single entry point for all localStorage / deserialization
 * corruption events.  Each call:
 *   1. Emits a structured logger.warn so the event appears in logs
 *   2. Forwards to an optional custom handler (telemetry, debug overlay, etc.)
 *   3. Returns the report object so callers can inspect or chain on it
 *
 * Future loadObject / type-guard call-sites should use this instead of
 * hand-rolling console.warn at each location.
 */

import { logger } from './logger';

export interface CorruptionReport {
  /** Logical source identifier (e.g. 'ProductionConfig', 'TutorialSystem') */
  source: string;
  /** Human-readable detail about what was detected */
  detail: string;
  /** ISO timestamp */
  timestamp: string;
  /** Whether the caller recovered gracefully (default: true) */
  recovered: boolean;
}

/** A subscriber that receives every corruption report. */
export type CorruptionHandler = (report: CorruptionReport) => void;

let activeHandler: CorruptionHandler | null = null;

/**
 * Install (or remove) a global corruption handler.
 * Pass `null` to uninstall.
 */
export function setCorruptionHandler(handler: CorruptionHandler | null): void {
  activeHandler = handler;
}

/**
 * Report a corruption event.
 *
 * @param source    Logical source identifier
 * @param detail    What was detected
 * @param recovered Whether the caller recovered (default: true)
 * @returns         The structured report object
 */
export function reportCorruption(
  source: string,
  detail: string,
  recovered = true,
): CorruptionReport {
  const report: CorruptionReport = {
    source,
    detail,
    timestamp: new Date().toISOString(),
    recovered,
  };

  // Always log so observability is guaranteed even without a handler
  logger.warn(`[Corruption:${source}] ${detail} (recovered=${recovered})`);

  // Forward to optional handler for telemetry / debug overlay
  if (activeHandler) {
    try {
      activeHandler(report);
    } catch {
      // Handler errors must never propagate to the caller
    }
  }

  return report;
}
