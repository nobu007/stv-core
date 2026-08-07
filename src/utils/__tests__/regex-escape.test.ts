/**
 * Pin for the regex-escape consolidation.
 *
 * Four byte-identical inline copies of the regex-escaping literal previously
 * lived in simple-diagram-detector.ts, diagram-detector.ts (×2), and
 * iteration-logger.ts — each guarding against ReDoS / pattern-injection when
 * keyword- or phase-derived text is built into a RegExp (ISS-013, ISS-024).
 * They are now a single `escapeRegex` in utils/regex-escape.ts. This file pins
 * the contract so a missed (or extra) metacharacter in the canonical helper is
 * caught before any of the four call sites silently re-opens its vector.
 */

import { describe, it, expect } from '@jest/globals';
import { escapeRegex } from '../regex-escape';

describe('escapeRegex: single source of truth for regex-literal escaping', () => {
  it('round-trips: an escaped literal always matches the original substring', () => {
    const metachars = '.*+?^${}()|[]\\';
    const hosts = ['', 'abc', 'word ', '  ', 'A B C'];
    for (const m of metachars) {
      for (const host of hosts) {
        const raw = `${host}${m}${host}`;
        const re = new RegExp(escapeRegex(raw));
        expect(re.test(raw)).toBe(true);
      }
    }
  });

  it('does not alter a metacharacter-free string', () => {
    expect(escapeRegex('hello world 123')).toBe('hello world 123');
    expect(escapeRegex('')).toBe('');
  });

  it('backslash-prefixes every regex metacharacter exactly once', () => {
    // Each of the 12 metacharacters becomes `\X`; ordinary punctuation is untouched.
    expect(escapeRegex('.')).toBe('\\.');
    expect(escapeRegex('*')).toBe('\\*');
    expect(escapeRegex('+')).toBe('\\+');
    expect(escapeRegex('?')).toBe('\\?');
    expect(escapeRegex('^')).toBe('\\^');
    expect(escapeRegex('$')).toBe('\\$');
    expect(escapeRegex('{')).toBe('\\{');
    expect(escapeRegex('}')).toBe('\\}');
    expect(escapeRegex('(')).toBe('\\(');
    expect(escapeRegex(')')).toBe('\\)');
    expect(escapeRegex('|')).toBe('\\|');
    expect(escapeRegex('[')).toBe('\\[');
    expect(escapeRegex(']')).toBe('\\]');
    expect(escapeRegex('\\')).toBe('\\\\');
    // Non-metachar punctuation must NOT be escaped (would change matching):
    expect(escapeRegex('!@#%=,/')).toBe('!@#%=,/');
  });

  it('keeps a metacharacter from acting as a quantifier/anchor when embedded', () => {
    // Without escaping, 'a*' would match 'aaa'; the escaped form must match the
    // literal 'a*' text only.
    expect(new RegExp(`^${escapeRegex('a*')}$`).test('aaa')).toBe(false);
    expect(new RegExp(`^${escapeRegex('a*')}$`).test('a*')).toBe(true);
    // Anchors neutralized:
    expect(new RegExp(`^${escapeRegex('^start')}$`).test('start')).toBe(false);
    expect(new RegExp(escapeRegex('^start')).test('^start')).toBe(true);
  });
});
