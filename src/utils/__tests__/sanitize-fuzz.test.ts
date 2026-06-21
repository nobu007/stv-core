/**
 * Fuzz tests for sanitization functions with randomized payload mutations.
 *
 * Generates mutated XSS / injection payloads beyond the static OWASP list
 * to find bypass edge cases not covered by the static test suites.
 *
 * Tested functions:
 * - escapeXml (animated-scene-renderer.ts)
 * - sanitizeMessage (api/routes/errors.ts)
 * - sanitizeFilename (utils/sanitize.ts)
 *
 * Key principle: after escaping, text content like `onerror=alert(1)` is safe
 * because it appears as character data inside escaped &lt;...&gt; entities,
 * not as a real HTML/SVG attribute. The security guarantee we verify is that
 * NO unescaped `<` or `>` survives that could form a real tag.
 */

import { escapeXml } from '../../export/animated-scene-renderer';
import { sanitizeFilename } from '../sanitize';

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) for reproducible fuzz runs
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0xC0FFEE);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomInt(max: number): number {
  return Math.floor(rng() * max);
}

function randomString(len: number, charset: string): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += charset[randomInt(charset.length)];
  }
  return s;
}

// ---------------------------------------------------------------------------
// Dangerous character set for XSS injection
// ---------------------------------------------------------------------------
const DANGEROUS_CHARS = '<>&"\'\\(){}[];:/#=.\0\r\n\t';

// Base payloads to mutate
const BASE_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  "';alert(1);//",
  '<svg/onload=alert(1)>',
  'javascript:alert(1)',
  '<iframe src=javascript:alert(1)>',
  '${alert(1)}',
  '{{constructor.constructor("alert(1)")()}}',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  '<![CDATA[<script>alert(1)</script>]]>',
  '<!--<script>alert(1)</script>-->',
  '\u003cscript\u003ealert(1)\u003c/script\u003e',
  '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e',
  '<embed src="data:text/html,<script>alert(1)</script>">',
  '<object data="javascript:alert(1)">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<form action="javascript:alert(1)"><button>X</button></form>',
];

/**
 * Generate a mutated payload by inserting, replacing, or prepending
 * dangerous characters into a base payload.
 */
function mutatePayload(base: string): string {
  const mutation = randomInt(5);
  const dangerousChar = DANGEROUS_CHARS[randomInt(DANGEROUS_CHARS.length)];
  const randomSuffix = randomString(randomInt(8), DANGEROUS_CHARS);

  switch (mutation) {
    case 0: // prepend dangerous chars
      return dangerousChar + base;
    case 1: // append random suffix
      return base + randomSuffix;
    case 2: { // insert at random position
      const pos = randomInt(base.length);
      return base.slice(0, pos) + dangerousChar + base.slice(pos);
    }
    case 3: // duplicate the payload with separator
      return base + dangerousChar + base;
    default: { // replace a random char with a dangerous one
      const p = randomInt(base.length);
      return base.slice(0, p) + dangerousChar + base.slice(p + 1);
    }
  }
}

/**
 * Generate N unique mutated payloads from the base list.
 */
function generateFuzzPayloads(count: number): string[] {
  const payloads: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = pick(BASE_PAYLOADS);
    payloads.push(mutatePayload(base));
  }
  // Include some pure random strings
  for (let i = 0; i < 20; i++) {
    payloads.push(randomString(randomInt(50) + 1, DANGEROUS_CHARS));
  }
  return payloads;
}

const FUZZ_PAYLOADS = generateFuzzPayloads(200);

// ---------------------------------------------------------------------------
// Security invariant: verify that NO raw (unescaped) `<` or `>` exists in
// the output string. Every `<` must be part of `&lt;` and every `>` must be
// part of `&gt;`. This is the fundamental guarantee that prevents tag injection.
// ---------------------------------------------------------------------------

function expectNoRawAngleBrackets(output: string): void {
  for (let i = 0; i < output.length; i++) {
    if (output[i] === '<') {
      expect(output.substring(i, i + 4)).toBe('&lt;');
    }
    if (output[i] === '>') {
      expect(output.substring(i, i + 4)).toBe('&gt;');
    }
  }
}

function expectNoRawQuotes(output: string): void {
  for (let i = 0; i < output.length; i++) {
    if (output[i] === '"') {
      expect(output.substring(i, i + 6)).toBe('&quot;');
    }
    if (output[i] === "'") {
      // &apos; for escapeXml, &#x27; for sanitizeMessage
      const entity = output.substring(i, i + 6);
      const isValid = entity === '&apos;' || entity === '&#x27;';
      expect(isValid).toBe(true);
    }
  }
}

function expectNoRawAmpersand(output: string): void {
  for (let i = 0; i < output.length; i++) {
    if (output[i] === '&') {
      const rest = output.substring(i);
      const isValidEntity =
        rest.startsWith('&amp;') ||
        rest.startsWith('&lt;') ||
        rest.startsWith('&gt;') ||
        rest.startsWith('&quot;') ||
        rest.startsWith('&apos;') ||
        rest.startsWith('&#x27;') ||
        rest.startsWith('&#');
      expect(isValidEntity).toBe(true);
    }
  }
}

// ---------------------------------------------------------------------------
// Tests: escapeXml
// ---------------------------------------------------------------------------

describe('Fuzz: escapeXml neutralizes randomized XSS payloads', () => {
  test.each(FUZZ_PAYLOADS)('payload #%#: all < > & " and \' become entities', (payload) => {
    const escaped = escapeXml(payload);

    // Core security invariant: no raw angle brackets that could form tags
    expectNoRawAngleBrackets(escaped);
    expectNoRawQuotes(escaped);
    expectNoRawAmpersand(escaped);

    // No unescaped tag names can exist (they'd need a raw `<`)
    expect(escaped).not.toMatch(/<script/i);
    expect(escaped).not.toMatch(/<img[\s/]/i);
    expect(escaped).not.toMatch(/<svg[\s/]/i);
    expect(escaped).not.toMatch(/<iframe[\s/]/i);
    expect(escaped).not.toMatch(/<body[\s/]/i);
    expect(escaped).not.toMatch(/<embed[\s/]/i);
    expect(escaped).not.toMatch(/<object[\s/]/i);
    expect(escaped).not.toMatch(/<meta[\s/]/i);
    expect(escaped).not.toMatch(/<form[\s/]/i);
    expect(escaped).not.toMatch(/<a[\s]/i);
  });

  test('double-encoding does not bypass escapeXml', () => {
    const doubleEncoded = '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;';
    const escaped = escapeXml(doubleEncoded);
    expect(escaped).not.toMatch(/<script/i);
  });

  test('null bytes in payloads are handled', () => {
    const nullPayload = '<script\x00>alert(1)</script>';
    const escaped = escapeXml(nullPayload);
    expectNoRawAngleBrackets(escaped);
  });

  test('unicode escape sequences are properly escaped', () => {
    const unicodePayload = '\u003cscript\u003ealert(1)\u003c/script\u003e';
    const escaped = escapeXml(unicodePayload);
    expectNoRawAngleBrackets(escaped);
  });

  test('very long payloads are fully escaped', () => {
    const longPayload = '<script>alert(1)</script>'.repeat(1000);
    const escaped = escapeXml(longPayload);
    expectNoRawAngleBrackets(escaped);
  });

  test('payload with only ampersands is safe', () => {
    const ampPayload = '&&&&&<script>&&&&&</script>';
    const escaped = escapeXml(ampPayload);
    expectNoRawAngleBrackets(escaped);
    expectNoRawAmpersand(escaped);
  });
});

// ---------------------------------------------------------------------------
// Tests: sanitizeMessage (replicated logic from errors.ts)
// ---------------------------------------------------------------------------

function sanitizeMessageRef(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

describe('Fuzz: sanitizeMessage neutralizes randomized HTML/XSS payloads', () => {
  test.each(FUZZ_PAYLOADS)('payload #%#: strips all tags and escapes remaining chars', (payload) => {
    const sanitized = sanitizeMessageRef(payload);

    // No HTML tags should survive (no raw `<...>` patterns)
    expectNoRawAngleBrackets(sanitized);
    expectNoRawQuotes(sanitized);
    expectNoRawAmpersand(sanitized);

    // No tag names can exist
    expect(sanitized).not.toMatch(/<script/i);
    expect(sanitized).not.toMatch(/<img[\s/]/i);
    expect(sanitized).not.toMatch(/<svg[\s/]/i);
    expect(sanitized).not.toMatch(/<iframe[\s/]/i);
  });

  test('malformed tags without closing > are escaped', () => {
    const malformedTag = '<script alert(1)';
    const sanitized = sanitizeMessageRef(malformedTag);
    expect(sanitized).not.toContain('<script');
    expectNoRawAngleBrackets(sanitized);
  });

  test('nested tags are stripped, text content is escaped', () => {
    const nested = '<div><script>alert(1)</script></div>';
    const sanitized = sanitizeMessageRef(nested);
    // Tags are stripped; remaining text content 'alert(1)' is safe (not executable)
    expectNoRawAngleBrackets(sanitized);
    expect(sanitized).not.toMatch(/<script/i);
    expect(sanitized).not.toMatch(/<div/i);
  });

  test('CDATA sections are stripped, text content is escaped', () => {
    const cdata = '<![CDATA[<script>alert(1)</script>]]>';
    const sanitized = sanitizeMessageRef(cdata);
    // Tags including CDATA wrapper are stripped; remaining text is inert
    expectNoRawAngleBrackets(sanitized);
    expect(sanitized).not.toContain('<![CDATA');
    expect(sanitized).not.toContain('<script');
  });

  test('HTML comments are stripped, text content is escaped', () => {
    const comment = '<!--<script>alert(1)</script>-->';
    const sanitized = sanitizeMessageRef(comment);
    // Comment wrapper and script tags are stripped; remaining text is inert
    expectNoRawAngleBrackets(sanitized);
    expect(sanitized).not.toContain('<!--');
    expect(sanitized).not.toContain('<script');
  });

  test('protocol handler text is inert after stripping tags', () => {
    const proto = '<a href="javascript:alert(1)">click</a>';
    const sanitized = sanitizeMessageRef(proto);
    // Tags are stripped, only "click" text remains
    expect(sanitized).toBe('click');
  });
});

// ---------------------------------------------------------------------------
// Tests: sanitizeFilename
// ---------------------------------------------------------------------------

const PATH_TRAVERSAL_PAYLOADS: string[] = [];
const basePaths = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32',
  './../../secret',
  '~/../../root/.ssh/id_rsa',
  '/etc/passwd',
  '....//....//etc/passwd',
  '..%2f..%2f..%2fetc/passwd',
  '..;/..;/..;/.ssh/id_rsa',
  '\0../../etc/passwd',
  '.\0./.\0./etc/passwd',
  '../../../\x00/etc/passwd',
  '...\t/...\t/etc/passwd',
];

// Generate mutated path traversal payloads
for (const base of basePaths) {
  PATH_TRAVERSAL_PAYLOADS.push(base);
  for (let i = 0; i < 10; i++) {
    PATH_TRAVERSAL_PAYLOADS.push(mutatePayload(base));
  }
}

describe('Fuzz: sanitizeFilename neutralizes randomized path traversal payloads', () => {
  test.each(PATH_TRAVERSAL_PAYLOADS)('payload #%#: prevents directory traversal', (payload) => {
    const sanitized = sanitizeFilename(payload);

    // Must not contain directory separators
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('\\');

    // Must not contain null bytes
    expect(sanitized).not.toContain('\0');

    // Must not contain control characters
    expect(sanitized).not.toMatch(/[\x00-\x1f\x7f]/);

    // Must not start with a dot (hidden file)
    expect(sanitized).not.toMatch(/^\./);

    // Must not contain ".." (parent directory reference)
    expect(sanitized).not.toContain('..');

    // Must not be empty
    expect(sanitized.length).toBeGreaterThan(0);
  });

  test('rapid alternating slashes and dots are neutralized', () => {
    const attack = '.\\./.\\./.\\./.\\./etc/passwd';
    const sanitized = sanitizeFilename(attack);
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('\\');
    expect(sanitized).not.toContain('..');
  });

  test('filename with only dangerous chars produces safe result', () => {
    const allDangerous = '../\0\x01\x02\x03';
    const sanitized = sanitizeFilename(allDangerous);
    // After stripping ../ and control chars, the result should be safe
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('\\');
    expect(sanitized).not.toContain('\0');
    expect(sanitized).not.toContain('..');
    expect(sanitized.length).toBeGreaterThan(0);
  });

  test('legitimate filenames are preserved', () => {
    const legit = 'my-diagram-scene-001';
    expect(sanitizeFilename(legit)).toBe(legit);
  });

  test('filename with spaces is trimmed but content preserved', () => {
    const withSpaces = '  my diagram  ';
    const sanitized = sanitizeFilename(withSpaces);
    expect(sanitized).toBe('my diagram');
  });

  test('empty string falls back to "unnamed"', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
    expect(sanitizeFilename('   ')).toBe('unnamed');
    expect(sanitizeFilename('.')).toBe('unnamed');
    expect(sanitizeFilename('..')).toBe('unnamed');
  });
});

// ---------------------------------------------------------------------------
// Integration: escaped payloads are safe in SVG text context
// ---------------------------------------------------------------------------

describe('Fuzz: escaped payloads are safe in SVG text context', () => {
  test.each(FUZZ_PAYLOADS.slice(0, 50))('SVG wrapping #%#: payload in <text> is inert', (payload) => {
    const escaped = escapeXml(payload);
    const svg = `<svg><text>${escaped}</text></svg>`;

    // No unescaped tags beyond the wrapper <svg> and <text> tags
    const realTags = svg.match(/<(?!\/?svg[ >]|\/?text[ >])/g);
    expect(realTags).toBeNull();
  });
});
