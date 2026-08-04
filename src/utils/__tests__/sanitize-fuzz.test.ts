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
 * - escapePDFString (multi-format-exporter.ts, private — replicated here)
 * - </script> escape regex (enhanced-export-engine.ts — replicated here)
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

/**
 * Seed resolution: default 0xC0FFEE for reproducibility; CI can override via
 * FUZZ_SEED env var to explore different payload spaces across runs.
 *
 * Usage in CI:
 *   FUZZ_SEED=$(date +%s) npx jest sanitize-fuzz
 *   FUZZ_SEED=random npx jest sanitize-fuzz
 */
function resolveFuzzSeed(): number {
  const envSeed = process.env.FUZZ_SEED;
  if (envSeed === undefined) return 0xC0FFEE;
  if (envSeed === 'random') return (Math.random() * 0xFFFFFFFF) >>> 0;
  const parsed = parseInt(envSeed, 10);
  return Number.isNaN(parsed) ? 0xC0FFEE : parsed >>> 0;
}

const FUZZ_SEED = resolveFuzzSeed();

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(FUZZ_SEED);

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
    // eslint-disable-next-line no-control-regex
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

// ---------------------------------------------------------------------------
// Tests: escapePDFString (replicated from multi-format-exporter.ts)
// ---------------------------------------------------------------------------
// The private method escapePDFString only escapes \, (, and ).
// PDF text strings are wrapped in parentheses, so unescaped parens can
// break the PDF content stream structure or inject operators.

function escapePdfStringRef(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

const PDF_INJECTION_PAYLOADS: string[] = [];
const pdfBases = [
  ') Tj (evil',
  ') Tj (\\) >>',
  '(BT) Tj (ET',
  '\\) Tj \\( evil',
  'text)more(paren(broken',
  '\\\\)\\\\(\\\\\\\\',
  'normal text (balanced) ok',
  '(unbalanced open',
  'unbalanced close)',
  ') >> /Annot /S /URI (http://evil',
  ') Tj (XSS) Tj (',
  '\\n\\r\\t\\0',
  'very)long(payload(with(many(parens',
  '\\\\\\\\\\\\\\\\',
  ')Tj(BT/Type/Annot/Subtype/Widget',
];

for (const base of pdfBases) {
  PDF_INJECTION_PAYLOADS.push(base);
  for (let i = 0; i < 10; i++) {
    PDF_INJECTION_PAYLOADS.push(mutatePayload(base));
  }
}
// Add pure random strings from PDF-dangerous charset
const PDF_DANGEROUS_CHARS = '\\(){}[]<>/%#.\0\r\n\t ;';
for (let i = 0; i < 20; i++) {
  PDF_INJECTION_PAYLOADS.push(randomString(randomInt(50) + 1, PDF_DANGEROUS_CHARS));
}

describe('Fuzz: escapePDFString neutralizes PDF injection payloads', () => {
  test.each(PDF_INJECTION_PAYLOADS)('payload #%#: all parens and backslashes escaped', (payload) => {
    const escaped = escapePdfStringRef(payload);

    // Security invariant: all unescaped ( and ) must be preceded by \
    for (let i = 0; i < escaped.length; i++) {
      if (escaped[i] === '(' || escaped[i] === ')') {
        expect(i).toBeGreaterThan(0);
        expect(escaped[i - 1]).toBe('\\');
      }
    }

    // Security invariant: all backslashes must be doubled (escaped \\
    // sequences) or used as escape prefixes for ( and )
    // Walk the string: each \ must be part of \\, \(, or \)
    for (let i = 0; i < escaped.length; i++) {
      if (escaped[i] === '\\') {
        const next = escaped[i + 1];
        // Valid escaped sequences: \\, \(, \)
        expect(next === '\\' || next === '(' || next === ')').toBe(true);
        // Skip the next char since it's part of this escape sequence
        i++;
      }
    }

    // The escaped string must be safe when placed inside PDF text parens:
    //   (escaped_string) Tj
    // Wrapping in (...) must not have premature closing paren
    const pdfText = `(${escaped})`;
    // Walk the wrapped string respecting PDF escape sequences.
    // Starting depth 0, the wrapping ( brings depth to 1, the wrapping )
    // brings it back to 0. No unescaped paren in the content should
    // cause depth to go negative or leave it unbalanced.
    let depth = 0;
    for (let i = 0; i < pdfText.length; i++) {
      if (pdfText[i] === '\\' && i + 1 < pdfText.length) {
        i++; // skip escaped char
        continue;
      }
      if (pdfText[i] === '(') depth++;
      if (pdfText[i] === ')') depth--;
    }
    expect(depth).toBe(0); // balanced
  });

  test('empty string is unchanged', () => {
    expect(escapePdfStringRef('')).toBe('');
  });

  test('legitimate text without special chars is unchanged', () => {
    const text = 'Hello World 123';
    expect(escapePdfStringRef(text)).toBe(text);
  });

  test('balanced parentheses in normal text are escaped', () => {
    const escaped = escapePdfStringRef('Hello (World)');
    expect(escaped).toBe('Hello \\(World\\)');
  });

  test('backslashes are doubled', () => {
    expect(escapePdfStringRef('\\')).toBe('\\\\');
    expect(escapePdfStringRef('\\\\')).toBe('\\\\\\\\');
  });
});

// ---------------------------------------------------------------------------
// Tests: </script> regex escape (from enhanced-export-engine.ts)
// ---------------------------------------------------------------------------
// The regex /<\/script>/gi replaces </script> (case-insensitive) with <\/script>
// to prevent HTML parser from closing the inline <script> tag when JSON
// data is embedded in HTML. The regex operates on JSON.stringify output.

function escapeScriptClose(json: string): string {
  return json.replace(/<\/script>/gi, '<\\/script>');
}

const SCRIPT_CLOSE_PAYLOADS: string[] = [];
const scriptBases = [
  '</script>',
  '</SCRIPT>',
  '</Script>',
  '</ScRiPt>',
  '</sCrIpT>',
  '</script><script>alert(1)</script>',
  'foo</script>bar',
  '</script>',
  '</script\t>',
  '</script\n>',
  '</script >',
  '</script\x00>',
  '</script/>',
  '</script\f>',
  '</script\r>',
  '"></script><img src=x>',
  "';</script>';",
  '</script></script>',
  'data:</script>',
  '\\u003c/script\\u003e',
  '</script\\x3e',
  'normal text without closing tags',
  '<script>not closed',
  '</style>',
  '</textarea>',
];

for (const base of scriptBases) {
  SCRIPT_CLOSE_PAYLOADS.push(base);
  for (let i = 0; i < 10; i++) {
    SCRIPT_CLOSE_PAYLOADS.push(mutatePayload(base));
  }
}

describe('Fuzz: </script> regex escape prevents HTML parser breakout', () => {
  test.each(SCRIPT_CLOSE_PAYLOADS)('payload #%#: no literal </script> survives', (payload) => {
    // Simulate the enhanced-export-engine.ts escape pipeline:
    // JSON.stringify(sceneData) then regex replace
    const jsonStr = JSON.stringify({ data: payload });
    const escaped = escapeScriptClose(jsonStr);

    // Security invariant: no literal </script> (case-insensitive) in the output
    // This is what the HTML parser would look for to close the <script> tag
    expect(escaped).not.toMatch(/<\/script>/i);
  });

  test('multiple </script> occurrences are all escaped', () => {
    const payload = 'a</script>b</script>c</script>d';
    const jsonStr = JSON.stringify({ data: payload });
    const escaped = escapeScriptClose(jsonStr);

    // Count occurrences of </script> (case-insensitive) in the original JSON
    const originalCount = (jsonStr.match(/<\/script>/gi) || []).length;
    expect(originalCount).toBe(3);

    // After escaping, zero should remain
    const remainingCount = (escaped.match(/<\/script>/gi) || []).length;
    expect(remainingCount).toBe(0);
  });

  test('nested JSON with </script> at multiple depths is safe', () => {
    const nested = {
      outer: '</script>',
      inner: { value: '</SCRIPT>' },
      array: ['</Script>', '</ScRiPt>'],
    };
    const jsonStr = JSON.stringify(nested);
    const escaped = escapeScriptClose(jsonStr);

    expect(escaped).not.toMatch(/<\/script>/i);
  });

  test('escaped JSON is still valid JSON after parse', () => {
    const payload = { value: '</script>alert(1)' };
    const jsonStr = JSON.stringify(payload);
    const escaped = escapeScriptClose(jsonStr);

    // The replacement <\/script> uses JSON-valid \\/ which JSON.parse
    // will interpret as </script> — data integrity is preserved
    const parsed = JSON.parse(escaped);
    expect(parsed.value).toBe('</script>alert(1)');
  });

  test('whitespace-variant closing tags are handled by JSON escaping', () => {
    // JSON.stringify escapes \t, \n, \r, \f to \\t, \\n, etc.
    // So </script\t> in source data becomes </script\\t> in JSON
    // which does NOT match the HTML parser's closing tag pattern
    const variants = ['</script\t>', '</script\n>', '</script\r>', '</script\f>'];
    for (const v of variants) {
      const jsonStr = JSON.stringify({ data: v });
      const escaped = escapeScriptClose(jsonStr);
      // The HTML parser should not see a real closing tag
      // because the whitespace is escaped by JSON.stringify
      expect(escaped).not.toMatch(/<\/script[>\s]/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: seed configurability
// ---------------------------------------------------------------------------

describe('Fuzz seed configuration', () => {
  test('default seed is 0xC0FFEE when FUZZ_SEED env var is not set', () => {
    // When FUZZ_SEED env var is not set, resolveFuzzSeed returns the default.
    const orig = process.env.FUZZ_SEED;
    delete process.env.FUZZ_SEED;
    expect(resolveFuzzSeed()).toBe(0xC0FFEE);
    if (orig !== undefined) process.env.FUZZ_SEED = orig;
  });

  test('FUZZ_SEED env var overrides default seed', () => {
    // Verify the resolveFuzzSeed function correctly parses env var
    const orig = process.env.FUZZ_SEED;
    process.env.FUZZ_SEED = '12345';
    expect(resolveFuzzSeed()).toBe(12345);
    process.env.FUZZ_SEED = 'random';
    const randomSeed = resolveFuzzSeed();
    expect(randomSeed).toBeGreaterThanOrEqual(0);
    expect(randomSeed).toBeLessThanOrEqual(0xFFFFFFFF);
    process.env.FUZZ_SEED = 'not-a-number';
    expect(resolveFuzzSeed()).toBe(0xC0FFEE);
    if (orig === undefined) {
      delete process.env.FUZZ_SEED;
    } else {
      process.env.FUZZ_SEED = orig;
    }
  });
});
