/**
 * Unicode script ranges — single source (round 23 of the freeze campaign).
 *
 * Before this module, four files hand-rolled "which characters are CJK/kana"
 * with four different memberships for the same script boundaries:
 *
 *   - analysis/language-detector.ts  code-point comparisons (most complete:
 *                                    kana + phonetic ext + Ext A + Compat)
 *   - analysis/semantic-similarity.ts tokenize class (Ext A + Hangul, no
 *                                    phonetic ext, no Compat)
 *   - analysis/scene-segmenter.ts    narrowest gate (no Ext A / Compat /
 *                                    Hangul) + three keyword sub-patterns
 *   - visualization/smart-label-sizer.ts width class (Hangul + the WHOLE
 *                                    FF00-FFEF block — including halfwidth
 *                                    katakana, which renders 1x, not 2x)
 *
 * Downstream defects of that drift: Ext-A/Compat kanji counted 1 char-unit
 * wide (labels ~2x over budget → overflow), halfwidth katakana counted 2x
 * (premature wrap/ellipsis), and Compat ideographs silently dropped from
 * LLM-cache tokens. Every consumer now composes its purpose from the named
 * ranges below; the frozen-literal registry bans re-freezing the boundaries
 * outside this file (escape, charCode-compare, and raw-literal range shapes).
 *
 * Deliberate exclusions (documented so they are not "fixed" later):
 *   - CJK Symbols and Punctuation U+3000-U+303F (、。「」) is NOT in
 *     WIDE_DISPLAY: no pre-round-23 width site counted it wide, and adding
 *     it would re-tune every Japanese label's wrap point — that is a tuning
 *     decision, not drift repair.
 *   - U+FFE0-U+FFEF fullwidth signs are East-Asian-Width "Ambiguous", not
 *     "Wide" — excluded from FULLWIDTH_WIDE_FORMS for the same reason.
 */

/** Inclusive Unicode code-point range [start, end]. */
export interface ScriptRange {
  readonly start: number;
  readonly end: number;
}

// ── Atomic script ranges ─────────────────────────────────────────

/** Hiragana ぀-ゟ */
export const HIRAGANA: ScriptRange = { start: 0x3040, end: 0x309f };

/** Katakana ゠-ヿ */
export const KATAKANA: ScriptRange = { start: 0x30a0, end: 0x30ff };

/** Katakana Phonetic Extensions ㇰ-㿿 (used e.g. for Ainu) */
export const KATAKANA_PHONETIC_EXTENSIONS: ScriptRange = { start: 0x31f0, end: 0x31ff };

/** CJK Unified Ideographs 一-鿿 */
export const CJK_UNIFIED_IDEOGRAPHS: ScriptRange = { start: 0x4e00, end: 0x9fff };

/** CJK Extension A 㐀-䶿 */
export const CJK_EXTENSION_A: ScriptRange = { start: 0x3400, end: 0x4dbf };

/** CJK Compatibility Ideographs 豈-﫿 */
export const CJK_COMPATIBILITY_IDEOGRAPHS: ScriptRange = { start: 0xf900, end: 0xfaff };

/** Hangul Syllables 가-힣 */
export const HANGUL_SYLLABLES: ScriptRange = { start: 0xac00, end: 0xd7af };

/**
 * Fullwidth wide forms ！-｠ (FF01-FF60): the half of the "Halfwidth and
 * Fullwidth Forms" block that actually renders ~2x wide. FF61-FF9D
 * (halfwidth katakana) and FF9E-FFDC (halfwidth hangul) render 1x and are
 * deliberately excluded.
 */
export const FULLWIDTH_WIDE_FORMS: ScriptRange = { start: 0xff01, end: 0xff60 };

// ── Purpose presets (same downstream meaning = one membership) ────

/** Kana: hiragana, katakana, katakana phonetic extensions. */
export const KANA_RANGES: readonly ScriptRange[] = [
  HIRAGANA,
  KATAKANA,
  KATAKANA_PHONETIC_EXTENSIONS,
];

/** CJK ideographs: unified + extension A + compatibility. */
export const CJK_IDEOGRAPH_RANGES: readonly ScriptRange[] = [
  CJK_UNIFIED_IDEOGRAPHS,
  CJK_EXTENSION_A,
  CJK_COMPATIBILITY_IDEOGRAPHS,
];

/** "Text contains Japanese script" — kana or CJK ideographs. */
export const JAPANESE_TEXT_RANGES: readonly ScriptRange[] = [
  ...KANA_RANGES,
  ...CJK_IDEOGRAPH_RANGES,
];

/**
 * Characters that are individually meaningful tokens (no space delimiters):
 * Japanese text plus Hangul. Used by tokenizers that split CJK per char.
 */
export const CJK_TOKEN_RANGES: readonly ScriptRange[] = [
  ...JAPANESE_TEXT_RANGES,
  HANGUL_SYLLABLES,
];

/**
 * Characters typically rendered ~2x the width of a Latin char in monospace
 * and most proportional fonts (the smart-label-sizer width model).
 */
export const WIDE_DISPLAY_RANGES: readonly ScriptRange[] = [
  ...CJK_TOKEN_RANGES,
  FULLWIDTH_WIDE_FORMS,
];

// ── Helpers ──────────────────────────────────────────────────────

/** True when `code` falls inside any of `ranges`. */
export function charInRanges(code: number, ranges: readonly ScriptRange[]): boolean {
  for (const r of ranges) {
    if (code >= r.start && code <= r.end) return true;
  }
  return false;
}

/** Regex class body for `ranges`, in `\uXXXX-\uXXXX` escape form. */
export function charClassSource(ranges: readonly ScriptRange[]): string {
  return ranges.map(r => `\\u${r.start.toString(16).toUpperCase().padStart(4, '0')}-\\u${r.end.toString(16).toUpperCase().padStart(4, '0')}`).join('');
}

/** Compiled `[...]` character class over `ranges`. */
export function buildCharClassRegex(ranges: readonly ScriptRange[], flags = ''): RegExp {
  return new RegExp(`[${charClassSource(ranges)}]`, flags);
}
