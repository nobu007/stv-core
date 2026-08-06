import {
  describe,
  it,
  expect,
} from '@jest/globals';

import {
  sanitizeFinite,
  sanitizeDiagramType,
  clampFinite,
  safeToLocaleString,
} from '../guards';

// ============================================================
// sanitizeFinite
// ============================================================

describe('sanitizeFinite', () => {
  // --- Valid finite numbers ---
  it('returns the value when it is a finite positive number', () => {
    expect(sanitizeFinite(0.85)).toBe(0.85);
  });

  it('returns the value when it is zero', () => {
    expect(sanitizeFinite(0)).toBe(0);
  });

  it('returns the value when it is a negative number', () => {
    expect(sanitizeFinite(-42)).toBe(-42);
  });

  it('returns the value when it is a very small number', () => {
    expect(sanitizeFinite(Number.EPSILON)).toBe(Number.EPSILON);
  });

  it('returns the value when it is a very large finite number', () => {
    expect(sanitizeFinite(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  // --- NaN ---
  it('returns default 0 for NaN', () => {
    expect(sanitizeFinite(NaN)).toBe(0);
  });

  it('returns custom default for NaN', () => {
    expect(sanitizeFinite(NaN, 0.5)).toBe(0.5);
  });

  // --- Infinity ---
  it('returns default 0 for positive Infinity', () => {
    expect(sanitizeFinite(Infinity)).toBe(0);
  });

  it('returns default 0 for negative Infinity', () => {
    expect(sanitizeFinite(-Infinity)).toBe(0);
  });

  it('returns custom default for Infinity', () => {
    expect(sanitizeFinite(Infinity, -1)).toBe(-1);
  });

  // --- Non-number values ---
  it('returns default for undefined', () => {
    expect(sanitizeFinite(undefined)).toBe(0);
  });

  it('returns default for null', () => {
    expect(sanitizeFinite(null)).toBe(0);
  });

  it('returns default for string', () => {
    expect(sanitizeFinite('0.85')).toBe(0);
  });

  it('returns default for empty string', () => {
    expect(sanitizeFinite('')).toBe(0);
  });

  it('returns default for object', () => {
    expect(sanitizeFinite({ value: 0.85 })).toBe(0);
  });

  it('returns default for array', () => {
    expect(sanitizeFinite([0.85])).toBe(0);
  });

  it('returns default for boolean true', () => {
    expect(sanitizeFinite(true)).toBe(0);
  });

  it('returns default for boolean false', () => {
    expect(sanitizeFinite(false)).toBe(0);
  });

  // --- Confidence-like scenarios ---
  it('handles realistic confidence values', () => {
    expect(sanitizeFinite(0.0)).toBe(0.0);
    expect(sanitizeFinite(0.5)).toBe(0.5);
    expect(sanitizeFinite(1.0)).toBe(1.0);
    expect(sanitizeFinite(0.999)).toBe(0.999);
  });

  it('prevents NaN from corrupting a sum', () => {
    const values = [0.8, NaN, 0.6, undefined as unknown as number, 0.9];
    const sum = values.reduce((acc, v) => acc + sanitizeFinite(v), 0);
    expect(sum).toBe(2.3); // 0.8 + 0 + 0.6 + 0 + 0.9
  });

  it('prevents Infinity from corrupting a sum', () => {
    const values = [0.8, Infinity, 0.6];
    const sum = values.reduce((acc, v) => acc + sanitizeFinite(v), 0);
    expect(sum).toBe(1.4); // 0.8 + 0 + 0.6
  });
});

// ============================================================
// sanitizeDiagramType
// ============================================================

describe('sanitizeDiagramType', () => {
  // --- Valid diagram types ---
  it.each([
    'flow',
    'flowchart',
    'tree',
    'timeline',
    'matrix',
    'cycle',
    'comparison',
    'network',
    'conceptmap',
    'mindmap',
    'general',
  ])('returns "%s" when it is a valid DiagramType', (type) => {
    expect(sanitizeDiagramType(type)).toBe(type);
  });

  // --- Invalid values ---
  it('returns "general" for empty string', () => {
    expect(sanitizeDiagramType('')).toBe('general');
  });

  it('returns "general" for undefined', () => {
    expect(sanitizeDiagramType(undefined)).toBe('general');
  });

  it('returns "general" for null', () => {
    expect(sanitizeDiagramType(null)).toBe('general');
  });

  it('returns "general" for invalid string', () => {
    expect(sanitizeDiagramType('invalid')).toBe('general');
  });

  it('returns "general" for "unknown" (common detection failure)', () => {
    expect(sanitizeDiagramType('unknown')).toBe('general');
  });

  it('returns "general" for number', () => {
    expect(sanitizeDiagramType(42)).toBe('general');
  });

  it('returns "general" for object', () => {
    expect(sanitizeDiagramType({ type: 'flow' })).toBe('general');
  });

  it('returns "general" for boolean', () => {
    expect(sanitizeDiagramType(true)).toBe('general');
  });

  // --- Custom default ---
  it('returns custom default for invalid value', () => {
    expect(sanitizeDiagramType('', 'flow')).toBe('flow');
  });

  it('returns custom default for undefined', () => {
    expect(sanitizeDiagramType(undefined, 'tree')).toBe('tree');
  });

  // --- Case sensitivity ---
  it('rejects uppercase valid type (case-sensitive)', () => {
    expect(sanitizeDiagramType('Flow')).toBe('general');
  });

  it('rejects mixed-case valid type', () => {
    expect(sanitizeDiagramType('FLOW')).toBe('general');
  });

  // --- Whitespace ---
  it('rejects type with leading/trailing whitespace', () => {
    expect(sanitizeDiagramType(' flow ')).toBe('general');
  });

  // --- Pipeline simulation ---
  it('simulates pipeline NaN-confidence scenario safely', () => {
    const mockAnalysis = {
      type: NaN as unknown as string,
      confidence: NaN,
      nodes: [],
      edges: [],
    };
    const safeType = sanitizeDiagramType(mockAnalysis.type);
    const safeConfidence = sanitizeFinite(mockAnalysis.confidence);

    expect(safeType).toBe('general');
    expect(safeConfidence).toBe(0);
    expect(() => safeConfidence > 0.6).not.toThrow();
  });

  it('simulates corrupted detection result safely', () => {
    const corrupted = {
      type: undefined,
      confidence: Infinity,
    };
    expect(sanitizeDiagramType(corrupted.type)).toBe('general');
    expect(sanitizeFinite(corrupted.confidence)).toBe(0);
  });
});

// ============================================================
// clampFinite
// ============================================================

describe('clampFinite', () => {
  it('returns value when within range', () => {
    expect(clampFinite(0.85, 0, 1)).toBe(0.85);
  });

  it('clamps to max when above range', () => {
    expect(clampFinite(1.5, 0, 1)).toBe(1);
  });

  it('clamps to min when below range', () => {
    expect(clampFinite(-0.3, 0, 1)).toBe(0);
  });

  it('returns min for NaN', () => {
    expect(clampFinite(NaN, 0, 1)).toBe(0);
  });

  it('returns max for Infinity', () => {
    expect(clampFinite(Infinity, 0, 1)).toBe(1); // Infinity > 0 → max
  });

  it('returns min for -Infinity', () => {
    expect(clampFinite(-Infinity, 0, 1)).toBe(0);
  });

  it('returns min for non-number', () => {
    expect(clampFinite('oops', 0, 1)).toBe(0);
  });

  it('returns min for undefined', () => {
    expect(clampFinite(undefined, 0, 1)).toBe(0);
  });

  it('works with negative ranges', () => {
    expect(clampFinite(-5, -10, -1)).toBe(-5);
    expect(clampFinite(0, -10, -1)).toBe(-1);
    expect(clampFinite(-15, -10, -1)).toBe(-10);
  });

  it('handles edge boundary values exactly', () => {
    expect(clampFinite(0, 0, 1)).toBe(0);
    expect(clampFinite(1, 0, 1)).toBe(1);
  });
});

// ============================================================
// safeToLocaleString
// ============================================================

describe('safeToLocaleString', () => {
  it('returns formatted string for valid number', () => {
    expect(safeToLocaleString(12345)).toBe((12345).toLocaleString());
  });

  it('returns formatted string for zero', () => {
    expect(safeToLocaleString(0)).toBe('0');
  });

  it('returns formatted string for negative number', () => {
    expect(safeToLocaleString(-1000)).toBe((-1000).toLocaleString());
  });

  it('returns "0" default for undefined', () => {
    expect(safeToLocaleString(undefined)).toBe('0');
  });

  it('returns "0" default for null', () => {
    expect(safeToLocaleString(null)).toBe('0');
  });

  it('returns "0" default for NaN', () => {
    expect(safeToLocaleString(NaN)).toBe('0');
  });

  it('returns "0" default for Infinity', () => {
    expect(safeToLocaleString(Infinity)).toBe('0');
  });

  it('returns "0" default for -Infinity', () => {
    expect(safeToLocaleString(-Infinity)).toBe('0');
  });

  it('returns "0" default for string', () => {
    expect(safeToLocaleString('hello')).toBe('0');
  });

  it('returns "0" default for object', () => {
    expect(safeToLocaleString({})).toBe('0');
  });

  it('returns custom default for undefined', () => {
    expect(safeToLocaleString(undefined, 'N/A')).toBe('N/A');
  });

  it('returns custom default for null', () => {
    expect(safeToLocaleString(null, '—')).toBe('—');
  });

  it('returns custom default for NaN', () => {
    expect(safeToLocaleString(NaN, '?')).toBe('?');
  });

  // --- Red-phase verification: unguarded .toLocaleString() would crash ---

  it('RED-PHASE: unguarded undefined.toLocaleString() throws TypeError', () => {
    // This proves the guard is necessary — the raw call crashes
    expect(() => (undefined as unknown as number).toLocaleString()).toThrow(TypeError);
  });

  it('RED-PHASE: unguarded null.toLocaleString() throws TypeError', () => {
    expect(() => (null as unknown as number).toLocaleString()).toThrow(TypeError);
  });
});
