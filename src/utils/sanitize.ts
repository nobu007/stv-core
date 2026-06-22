/**
 * Filename sanitization utilities for safe file path handling.
 *
 * Prevents path traversal, null-byte injection, and other filename-based
 * attacks across API endpoints.
 */

/**
 * Characters and patterns that are stripped or replaced in filenames.
 */
const UNSAFE_PATTERN = /[/\\]/g;
const DOTDOT_PATTERN = /\.\./g;
const NULL_BYTE_PATTERN = /\0/g;
// eslint-disable-next-line no-control-regex -- intentionally matches control characters for sanitization
const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/g;
// Unicode directional override characters — used for filename spoofing attacks
const RTL_OVERRIDE_PATTERN = /[\u202e\u202d\u202c\u200f\u200e\ufeff]/g;
const MAX_FILENAME_LENGTH = 255;

/**
 * Sanitize a user-supplied filename to prevent path traversal and injection.
 *
 * Handles:
 * - Directory separators (`/` and `\`) → replaced with `_`
 * - Parent directory traversals (`..`) → removed
 * - Null bytes (`\0`) → removed
 * - Control characters (0x00-0x1F, 0x7F) → removed
 * - Unicode directional overrides (U+202E, U+202D, etc.) → removed
 * - Leading dots (hidden files) → stripped
 * - Excessive length → truncated to 255 chars (filesystem limit)
 * - Whitespace trimming
 * - Empty result fallback → `unnamed`
 */
export function sanitizeFilename(input: string): string {
  let name = input
    .replace(NULL_BYTE_PATTERN, '')
    .replace(RTL_OVERRIDE_PATTERN, '')
    .replace(UNSAFE_PATTERN, '_')
    .replace(DOTDOT_PATTERN, '')
    .replace(CONTROL_CHAR_PATTERN, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  if (name.length === 0) {
    name = 'unnamed';
  }

  return name;
}
