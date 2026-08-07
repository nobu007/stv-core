/**
 * Escape a literal string so it matches itself when embedded in a RegExp.
 *
 * Backslash-escapes every regex metacharacter. This is the SINGLE source of
 * truth for regex-escaping in the codebase — four byte-identical inline copies
 * previously lived in simple-diagram-detector.ts, diagram-detector.ts (×2) and
 * iteration-logger.ts, each guarding against ReDoS / pattern-injection when
 * user- or keyword-derived text is built into a RegExp. Any one copy drifting
 * (a missed metacharacter) would silently re-open that vector, so they are
 * consolidated here. Import this instead of re-inlining the literal.
 *
 * @param s - the literal substring to make regex-safe
 * @returns `s` with every regex metacharacter backslash-escaped
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
