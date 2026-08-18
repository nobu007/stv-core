// src/lib/unicode-script-ranges.ts
var HIRAGANA = { start: 12352, end: 12447 };
var KATAKANA = { start: 12448, end: 12543 };
var KATAKANA_PHONETIC_EXTENSIONS = { start: 12784, end: 12799 };
var CJK_UNIFIED_IDEOGRAPHS = { start: 19968, end: 40959 };
var CJK_EXTENSION_A = { start: 13312, end: 19903 };
var CJK_COMPATIBILITY_IDEOGRAPHS = { start: 63744, end: 64255 };
var HANGUL_SYLLABLES = { start: 44032, end: 55215 };
var FULLWIDTH_WIDE_FORMS = { start: 65281, end: 65376 };
var KANA_RANGES = [
  HIRAGANA,
  KATAKANA,
  KATAKANA_PHONETIC_EXTENSIONS
];
var CJK_IDEOGRAPH_RANGES = [
  CJK_UNIFIED_IDEOGRAPHS,
  CJK_EXTENSION_A,
  CJK_COMPATIBILITY_IDEOGRAPHS
];
var JAPANESE_TEXT_RANGES = [
  ...KANA_RANGES,
  ...CJK_IDEOGRAPH_RANGES
];
var CJK_TOKEN_RANGES = [
  ...JAPANESE_TEXT_RANGES,
  HANGUL_SYLLABLES
];
var WIDE_DISPLAY_RANGES = [
  ...CJK_TOKEN_RANGES,
  FULLWIDTH_WIDE_FORMS
];
function charInRanges(code, ranges) {
  for (const r of ranges) {
    if (code >= r.start && code <= r.end) return true;
  }
  return false;
}
function charClassSource(ranges) {
  return ranges.map((r) => `\\u${r.start.toString(16).toUpperCase().padStart(4, "0")}-\\u${r.end.toString(16).toUpperCase().padStart(4, "0")}`).join("");
}
function buildCharClassRegex(ranges, flags = "") {
  return new RegExp(`[${charClassSource(ranges)}]`, flags);
}
export {
  CJK_COMPATIBILITY_IDEOGRAPHS,
  CJK_EXTENSION_A,
  CJK_IDEOGRAPH_RANGES,
  CJK_TOKEN_RANGES,
  CJK_UNIFIED_IDEOGRAPHS,
  FULLWIDTH_WIDE_FORMS,
  HANGUL_SYLLABLES,
  HIRAGANA,
  JAPANESE_TEXT_RANGES,
  KANA_RANGES,
  KATAKANA,
  KATAKANA_PHONETIC_EXTENSIONS,
  WIDE_DISPLAY_RANGES,
  buildCharClassRegex,
  charClassSource,
  charInRanges
};
