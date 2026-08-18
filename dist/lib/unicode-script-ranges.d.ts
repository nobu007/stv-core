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
/** Hiragana ぀-ゟ */
export declare const HIRAGANA: ScriptRange;
/** Katakana ゠-ヿ */
export declare const KATAKANA: ScriptRange;
/** Katakana Phonetic Extensions ㇰ-㿿 (used e.g. for Ainu) */
export declare const KATAKANA_PHONETIC_EXTENSIONS: ScriptRange;
/** CJK Unified Ideographs 一-鿿 */
export declare const CJK_UNIFIED_IDEOGRAPHS: ScriptRange;
/** CJK Extension A 㐀-䶿 */
export declare const CJK_EXTENSION_A: ScriptRange;
/** CJK Compatibility Ideographs 豈-﫿 */
export declare const CJK_COMPATIBILITY_IDEOGRAPHS: ScriptRange;
/** Hangul Syllables 가-힣 */
export declare const HANGUL_SYLLABLES: ScriptRange;
/**
 * Fullwidth wide forms ！-｠ (FF01-FF60): the half of the "Halfwidth and
 * Fullwidth Forms" block that actually renders ~2x wide. FF61-FF9D
 * (halfwidth katakana) and FF9E-FFDC (halfwidth hangul) render 1x and are
 * deliberately excluded.
 */
export declare const FULLWIDTH_WIDE_FORMS: ScriptRange;
/** Kana: hiragana, katakana, katakana phonetic extensions. */
export declare const KANA_RANGES: readonly ScriptRange[];
/** CJK ideographs: unified + extension A + compatibility. */
export declare const CJK_IDEOGRAPH_RANGES: readonly ScriptRange[];
/** "Text contains Japanese script" — kana or CJK ideographs. */
export declare const JAPANESE_TEXT_RANGES: readonly ScriptRange[];
/**
 * Characters that are individually meaningful tokens (no space delimiters):
 * Japanese text plus Hangul. Used by tokenizers that split CJK per char.
 */
export declare const CJK_TOKEN_RANGES: readonly ScriptRange[];
/**
 * Characters typically rendered ~2x the width of a Latin char in monospace
 * and most proportional fonts (the smart-label-sizer width model).
 */
export declare const WIDE_DISPLAY_RANGES: readonly ScriptRange[];
/** True when `code` falls inside any of `ranges`. */
export declare function charInRanges(code: number, ranges: readonly ScriptRange[]): boolean;
/** Regex class body for `ranges`, in `\uXXXX-\uXXXX` escape form. */
export declare function charClassSource(ranges: readonly ScriptRange[]): string;
/** Compiled `[...]` character class over `ranges`. */
export declare function buildCharClassRegex(ranges: readonly ScriptRange[], flags?: string): RegExp;
