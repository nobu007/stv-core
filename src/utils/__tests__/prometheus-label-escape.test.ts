/**
 * Cross-invariant pin for the Prometheus label-value escape consolidation.
 *
 * Two hand-rolled copies previously lived in `monitoring/prometheus-exporter.ts`
 * (`sanitizeLabelValue`, which stripped ALL control chars including the newline)
 * and `export/security-metrics-collector.ts` (`sanitizePrometheusLabel`, which
 * escaped the newline but left carriage-return / tab / other control chars
 * untouched). Both defended against the same label-injection attack yet had
 * drifted on exactly the break-out characters. The logic now has ONE definition
 * in `prometheus-label-escape.ts`; both emitters import it. This file pins the
 * unified behavior so a re-divergence is caught immediately.
 *
 * Reuses the shared fuzz helper (@tests/helpers/fuzz) for determinism.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import {
  sanitizePrometheusLabel,
  MAX_PROMETHEUS_LABEL_LENGTH,
} from '../prometheus-label-escape';

/**
 * A sanitized label value (the inner string placed between the surrounding
 * `"…"`) must never carry:
 *   - a raw newline / carriage-return / tab / other control char (would break
 *     the line-oriented format or re-open injection), and
 *   - a raw `"` (would close the label value prematurely) or a stray `\`.
 * The canonical escaper only ever emits three two-char escapes (`\\`, `\"`,
 * `\n`) plus lone non-backslash, non-quote characters, so a value that
 * decomposes into exactly those pieces has no break-out surface.
 */
function isSafeInnerValue(s: string): boolean {
  // No raw control characters at all (0x00-0x1f includes LF/CR/TAB; 0x7f = DEL).
  // eslint-disable-next-line no-control-regex -- intentional: this helper exists to detect control chars
  if (/[\x00-\x1f\x7f]/.test(s)) return false;
  // Must decompose into the three legal escapes or a lone safe char. Any raw `"`,
  // any lone/stray backslash, or any other anomaly fails this.
  return /^((\\\\|\\"|\\n)|[^\\"])*$/.test(s);
}

describe('Prometheus label escape: single source of truth (prometheus-label-escape.ts)', () => {
  // -------------------------------------------------------------------------
  // Literal anchors — the spec-mandated escapes + the replacement order.
  // -------------------------------------------------------------------------
  describe('literal anchors: required escapes and order', () => {
    it('escapes backslash, double-quote, and newline per Prometheus exposition spec', () => {
      expect(sanitizePrometheusLabel('\\')).toBe('\\\\');
      expect(sanitizePrometheusLabel('"')).toBe('\\"');
      // newline (LF) becomes the literal two-char sequence backslash + n
      expect(sanitizePrometheusLabel('\n')).toBe('\\n');
    });

    it('escapes backslash BEFORE the others so emitted escape sequences are not double-encoded', () => {
      // A raw newline must become exactly `\n` (2 chars), never `\\n` (3) — the
      // latter would mean the backslash we emitted for the newline was itself
      // backslash-escaped again (wrong order).
      expect(sanitizePrometheusLabel('\n')).toBe('\\n');
      expect(sanitizePrometheusLabel('\n')).not.toBe('\\\\n');
      // A literal backslash-n in the INPUT (not a newline) stays backslash-n,
      // with the single backslash doubled:
      expect(sanitizePrometheusLabel('\\n')).toBe('\\\\n');
    });

    it('round-trips: the escaped value placed inside quotes cannot break out', () => {
      // The exact payload that was tested in the former collector copy: a pattern
      // name that closes its label value and injects a fake HELP/TYPE/metric.
      const attack = 'script-tag"} 0\n# HELP fake_metric fake\n# TYPE fake_metric counter\nfake_metric{layer="x';
      const escaped = sanitizePrometheusLabel(attack);
      // The escaped inner value is a single line with no raw break-out chars.
      expect(isSafeInnerValue(escaped)).toBe(true);
      expect(escaped.split('\n')).toHaveLength(1);
      // The injected directive text is trapped INSIDE the value as a literal
      // substring (still present), but it cannot form its own line — which is the
      // actual security property. The full-label assertions live in the consumer
      // tests (no separate `# HELP fake_metric` LINE in the rendered output).
    });
  });

  // -------------------------------------------------------------------------
  // Regression anchors for the EXACT drift that existed between the two former
  // copies. The exporter stripped these; the collector left them raw. The
  // canonical must strip them (they have no spec escape and corrupt the format).
  // -------------------------------------------------------------------------
  describe('regression: characters the two copies previously disagreed on', () => {
    it('strips carriage returns (exporter stripped, collector left raw)', () => {
      // A CRLF in a label value: the LF is escaped, the CR is removed entirely
      // (a raw CR would corrupt the line-oriented format on CRLF-reading parsers).
      expect(sanitizePrometheusLabel('a\rb')).toBe('ab');
      expect(sanitizePrometheusLabel('a\r\nb')).toBe('a\\nb');
      expect(sanitizePrometheusLabel('\r')).toBe('');
    });

    it('strips tabs (exporter stripped, collector left raw)', () => {
      expect(sanitizePrometheusLabel('a\tb')).toBe('ab');
      expect(sanitizePrometheusLabel('\t')).toBe('');
    });

    it('strips other control chars (NUL, DEL, vertical/horizontal tab, form feed)', () => {
      expect(sanitizePrometheusLabel('a\x00b')).toBe('ab');
      expect(sanitizePrometheusLabel('a\x7fb')).toBe('ab');
      expect(sanitizePrometheusLabel('\x0b\x0c')).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Length cap.
  // -------------------------------------------------------------------------
  describe('length cap', () => {
    it('truncates to MAX_PROMETHEUS_LABEL_LENGTH', () => {
      const long = 'A'.repeat(MAX_PROMETHEUS_LABEL_LENGTH * 3);
      const out = sanitizePrometheusLabel(long);
      expect(out.length).toBe(MAX_PROMETHEUS_LABEL_LENGTH);
    });

    it('does not grow the cap for backslash-heavy input (escape-then-slice keeps output bounded)', () => {
      const long = '\\'.repeat(MAX_PROMETHEUS_LABEL_LENGTH * 3);
      const out = sanitizePrometheusLabel(long);
      expect(out.length).toBeLessThanOrEqual(MAX_PROMETHEUS_LABEL_LENGTH);
      // and is still a valid (if truncated) escaped value
      expect(isSafeInnerValue(out)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Fuzz — arbitrary attack payloads produce a safe inner value.
  // -------------------------------------------------------------------------
  describe('fuzz: every payload yields a safe inner value', () => {
    // Alphabet biased toward the break-out / divergence characters.
    const alphabet = 'abcABC0 =";\\\n\r\t\x00\x0b\x0c\x7f';

    it('5000 random payloads leave no raw control char and no raw quote', () => {
      const rng = mulberry32(0x70726f); // 'pro'
      for (let i = 0; i < 5000; i++) {
        const len = Math.floor(rng() * 32);
        let s = '';
        for (let j = 0; j < len; j++) {
          s += alphabet[Math.floor(rng() * alphabet.length)];
        }
        const out = sanitizePrometheusLabel(s);
        expect(isSafeInnerValue(out)).toBe(true);
        // Output never exceeds the cap.
        expect(out.length).toBeLessThanOrEqual(MAX_PROMETHEUS_LABEL_LENGTH);
      }
    });

    it('every break-out character, in every position, is neutralized', () => {
      const safe = 'abcXYZ';
      const breakouts = ['\n', '\r', '\t', '"', '\\', '\x00', '\x7f'];
      for (const c of breakouts) {
        for (const input of [c + safe, safe + c, 'ab' + c + 'cd']) {
          expect(isSafeInnerValue(sanitizePrometheusLabel(input))).toBe(true);
        }
      }
    });
  });
});
