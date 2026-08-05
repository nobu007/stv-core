/**
 * Tests for safeLoadFromStorage utility.
 *
 * Verifies that the utility handles all corruption classes
 * (parse errors, type mismatches, localStorage failures) with
 * centralized reportCorruption observability.
 */

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { safeLoadFromStorage, safeSaveToStorage } from '../safe-storage';
import { setCorruptionHandler, type CorruptionReport } from '../report-corruption';

// ── localStorage mock ──
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
  clear: jest.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── Type guards ──
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('safeLoadFromStorage', () => {
  let reports: CorruptionReport[];

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    reports = [];
    setCorruptionHandler((r) => reports.push(r));
  });

  afterEach(() => {
    setCorruptionHandler(null);
  });

  describe('happy path', () => {
    it('returns parsed value when valid', () => {
      mockStorage['my-key'] = JSON.stringify(['a', 'b', 'c']);
      const result = safeLoadFromStorage('my-key', isStringArray, 'Test', []);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('returns default when key does not exist', () => {
      const result = safeLoadFromStorage('missing', isStringArray, 'Test', ['default']);
      expect(result).toEqual(['default']);
    });

    it('returns default when key is null (no localStorage entry)', () => {
      const result = safeLoadFromStorage('absent', isRecord, 'Test', { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it('does not emit corruption report for missing keys', () => {
      safeLoadFromStorage('missing', isStringArray, 'Test', []);
      expect(reports).toHaveLength(0);
    });

    it('does not emit corruption report for valid data', () => {
      mockStorage['valid'] = JSON.stringify({ key: 'value' });
      safeLoadFromStorage('valid', isRecord, 'Test', {});
      expect(reports).toHaveLength(0);
    });

    it('does not call removeItem for valid data', () => {
      mockStorage['valid'] = JSON.stringify(['ok']);
      safeLoadFromStorage('valid', isStringArray, 'Test', []);
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('unparseable JSON', () => {
    it('returns default for garbled JSON', () => {
      mockStorage['broken'] = '}}}garbled{{{';
      const result = safeLoadFromStorage('broken', isStringArray, 'Test', []);
      expect(result).toEqual([]);
    });

    it('emits corruption report mentioning unparseable JSON', () => {
      mockStorage['broken'] = '!!!not json!!!';
      safeLoadFromStorage('broken', isStringArray, 'MySource', []);
      expect(reports).toHaveLength(1);
      expect(reports[0].source).toBe('MySource');
      expect(reports[0].detail).toContain('unparseable');
      expect(reports[0].recovered).toBe(true);
    });

    it('removes corrupted entry', () => {
      mockStorage['broken'] = '{{bad}}';
      safeLoadFromStorage('broken', isStringArray, 'Test', []);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('broken');
    });
  });

  describe('type validation failure', () => {
    it('returns default when type guard rejects', () => {
      mockStorage['wrong-type'] = JSON.stringify({ not: 'an array' });
      const result = safeLoadFromStorage('wrong-type', isStringArray, 'Test', ['default']);
      expect(result).toEqual(['default']);
    });

    it('emits corruption report mentioning type validation', () => {
      mockStorage['wrong-type'] = JSON.stringify(42);
      safeLoadFromStorage('wrong-type', isStringArray, 'Hook', []);
      expect(reports).toHaveLength(1);
      expect(reports[0].source).toBe('Hook');
      expect(reports[0].detail).toContain('type validation');
    });

    it('removes entry that fails type validation', () => {
      mockStorage['wrong'] = JSON.stringify('string-not-array');
      safeLoadFromStorage('wrong', isStringArray, 'Test', []);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('wrong');
    });

    it('rejects null even though JSON.parse succeeds', () => {
      mockStorage['null-val'] = JSON.stringify(null);
      const result = safeLoadFromStorage('null-val', isStringArray, 'Test', ['fallback']);
      expect(result).toEqual(['fallback']);
      expect(reports).toHaveLength(1);
    });

    it('rejects array when object is expected', () => {
      mockStorage['arr'] = JSON.stringify([1, 2, 3]);
      const result = safeLoadFromStorage('arr', isRecord, 'Test', {});
      expect(result).toEqual({});
      expect(reports).toHaveLength(1);
    });
  });

  describe('localStorage access failure', () => {
    it('returns default when localStorage.getItem throws', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      const result = safeLoadFromStorage('any', isStringArray, 'Test', ['safe']);
      expect(result).toEqual(['safe']);
    });

    it('emits corruption report when localStorage.getItem throws', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceeded');
      });
      safeLoadFromStorage('any', isStringArray, 'Test', []);
      expect(reports).toHaveLength(1);
      expect(reports[0].source).toBe('Test');
      expect(reports[0].detail).toContain('getItem');
      expect(reports[0].detail).toContain('QuotaExceeded');
      expect(reports[0].recovered).toBe(true);
    });

    it('does not crash when removeItem throws', () => {
      mockStorage['bad'] = 'not json';
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('remove failed');
      });
      expect(() => safeLoadFromStorage('bad', isStringArray, 'Test', [])).not.toThrow();
    });
  });

  describe('multiple sequential calls', () => {
    it('handles mix of valid and corrupted keys', () => {
      mockStorage['good'] = JSON.stringify(['a']);
      mockStorage['bad'] = '{{corrupted}}';
      mockStorage['wrong-type'] = JSON.stringify(42);

      const r1 = safeLoadFromStorage('good', isStringArray, 'Multi', []);
      const r2 = safeLoadFromStorage('bad', isStringArray, 'Multi', []);
      const r3 = safeLoadFromStorage('wrong-type', isStringArray, 'Multi', []);

      expect(r1).toEqual(['a']);
      expect(r2).toEqual([]);
      expect(r3).toEqual([]);
      expect(reports).toHaveLength(2); // bad + wrong-type
      expect(reports.every(r => r.source === 'Multi')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty string value', () => {
      mockStorage['empty'] = '';
      // Empty string is truthy enough to reach JSON.parse, which will throw
      const result = safeLoadFromStorage('empty', isStringArray, 'Test', ['default']);
      expect(result).toEqual(['default']);
    });

    it('handles "null" string literal as JSON', () => {
      mockStorage['null-literal'] = 'null';
      const result = safeLoadFromStorage('null-literal', isStringArray, 'Test', ['d']);
      expect(result).toEqual(['d']);
      expect(reports).toHaveLength(1);
    });

    it('preserves default value identity for objects', () => {
      const defaultObj = { immutable: true };
      mockStorage['bad'] = '{{corrupted}}';
      const result = safeLoadFromStorage('bad', isRecord, 'Test', defaultObj);
      expect(result).toBe(defaultObj);
    });
  });
});

describe('safeSaveToStorage', () => {
  let reports: CorruptionReport[];

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    reports = [];
    setCorruptionHandler((r) => reports.push(r));
  });

  afterEach(() => {
    setCorruptionHandler(null);
  });

  describe('happy path', () => {
    it('serializes and stores value successfully', () => {
      const result = safeSaveToStorage('test-key', { name: 'abc' }, 'TestSource');
      expect(result).toBe(true);
      expect(mockStorage['test-key']).toBe(JSON.stringify({ name: 'abc' }));
    });

    it('stores arrays correctly', () => {
      const result = safeSaveToStorage('arr', [1, 2, 3], 'TestSource');
      expect(result).toBe(true);
      expect(mockStorage['arr']).toBe('[1,2,3]');
    });

    it('stores primitives correctly', () => {
      expect(safeSaveToStorage('num', 42, 'TestSource')).toBe(true);
      expect(mockStorage['num']).toBe('42');

      expect(safeSaveToStorage('str', 'hello', 'TestSource')).toBe(true);
      expect(mockStorage['str']).toBe('"hello"');

      expect(safeSaveToStorage('bool', true, 'TestSource')).toBe(true);
      expect(mockStorage['bool']).toBe('true');
    });

    it('stores null correctly', () => {
      expect(safeSaveToStorage('null-val', null, 'TestSource')).toBe(true);
      expect(mockStorage['null-val']).toBe('null');
    });

    it('does not emit corruption report on success', () => {
      safeSaveToStorage('ok', { data: 1 }, 'TestSource');
      expect(reports).toHaveLength(0);
    });
  });

  describe('serialization failure', () => {
    it('returns false for circular references', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = safeSaveToStorage('circular', circular, 'CircularSource');
      expect(result).toBe(false);
    });

    it('emits corruption report for serialization failure', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      safeSaveToStorage('circular', circular, 'CircularSource');
      expect(reports).toHaveLength(1);
      expect(reports[0].source).toBe('CircularSource');
      expect(reports[0].detail).toContain('could not be serialized');
    });

    it('does not write to localStorage on serialization failure', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      safeSaveToStorage('circular', circular, 'TestSource');
      expect(mockStorage['circular']).toBeUndefined();
    });
  });

  describe('localStorage.setItem failure', () => {
    it('returns false when setItem throws (quota exceeded)', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });
      const result = safeSaveToStorage('quota', { data: 'test' }, 'QuotaSource');
      expect(result).toBe(false);
    });

    it('emits corruption report when setItem throws', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      safeSaveToStorage('denied', { data: 1 }, 'SecuritySource');
      expect(reports).toHaveLength(1);
      expect(reports[0].source).toBe('SecuritySource');
      expect(reports[0].detail).toContain('write failed');
    });
  });

  describe('round-trip: safeSaveToStorage → safeLoadFromStorage', () => {
    it('value saved by safeSave can be loaded by safeLoad', () => {
      const data = { items: ['a', 'b'], count: 2 };
      safeSaveToStorage('rt', data, 'RoundTrip');

      const loaded = safeLoadFromStorage(
        'rt',
        (v): v is typeof data => v !== null && typeof v === 'object' && !Array.isArray(v),
        'RoundTrip',
        { items: [], count: 0 },
      );

      expect(loaded).toEqual(data);
    });
  });
});
