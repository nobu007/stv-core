/**
 * Canonical sanitizer for a Prometheus exposition-format label value.
 *
 * This is the SINGLE source of truth for Prometheus label-value escaping in the
 * codebase. Two hand-rolled copies previously lived in
 * `monitoring/prometheus-exporter.ts` (`sanitizeLabelValue`) and
 * `export/security-metrics-collector.ts` (`sanitizePrometheusLabel`) — both on
 * the metrics-export security path, both defending against the same
 * label-injection attack (a malicious label value closing its quotes and
 * emitting fake metric lines). They had drifted on exactly the characters an
 * attacker would use to break out of a label value:
 *
 *   - the exporter stripped EVERY control character (including the newline),
 *     losing information and diverging from the spec-mandated `\n` escape;
 *   - the collector escaped the newline but left carriage return / tab / other
 *     control characters untouched, so a CR could still corrupt the
 *     line-oriented format.
 *
 * Per the Prometheus text exposition format (v0.0.4), inside a label value the
 * characters `\`, `"`, and newline MUST be escaped as `\\`, `\"`, and `\n`.
 * Every other control character has no defined escape and would either corrupt
 * the line-oriented format or re-open the injection vector, so it is stripped.
 * Import this instead of re-inlining a second copy.
 *
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 */

/** Maximum length of a rendered label value (defensive cap, matches both former copies). */
export const MAX_PROMETHEUS_LABEL_LENGTH = 200;

/**
 * Escape `value` so it is safe to embed between double-quotes in a Prometheus
 * label value (`key="value"`).
 *
 * Replacement order matters: backslash is escaped FIRST so the escape sequences
 * this function itself emits (`\\"`, `\\n`) are not re-escaped.
 *
 * @param value - the raw label value to sanitize
 * @returns a string safe to place inside a Prometheus `"…"` label value
 */
export function sanitizePrometheusLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // escape backslashes FIRST
    .replace(/"/g, '\\"') // escape double quotes
    .replace(/\n/g, '\\n') // escape newlines (spec-required)
    // eslint-disable-next-line no-control-regex -- intentional: this regex's purpose is to strip control chars
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '') // strip other control chars (CR, TAB, NUL, DEL, …)
    .slice(0, MAX_PROMETHEUS_LABEL_LENGTH);
}
