/**
 * Filename sanitization utilities for safe file path handling.
 *
 * Prevents path traversal, null-byte injection, and other filename-based
 * attacks across API endpoints.
 */
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
export declare function sanitizeFilename(input: string): string;
