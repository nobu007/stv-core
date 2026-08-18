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
/**
 * Install (or remove) a global corruption handler.
 * Pass `null` to uninstall.
 */
export declare function setCorruptionHandler(handler: CorruptionHandler | null): void;
/**
 * Report a corruption event.
 *
 * @param source    Logical source identifier
 * @param detail    What was detected
 * @param recovered Whether the caller recovered (default: true)
 * @returns         The structured report object
 */
export declare function reportCorruption(source: string, detail: string, recovered?: boolean): CorruptionReport;
