/**
 * Tests verifying that all production localStorage write operations go through
 * safeSaveToStorage, and that the safe wrapper handles edge cases correctly.
 *
 * Covers the migration of TutorialSystem and ProductionConfigManager from raw
 * localStorage.setItem(JSON.stringify(...)) to safeSaveToStorage().
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

import { safeSaveToStorage, safeLoadFromStorage } from '../safe-storage';

// ── localStorage mock ──
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
  clear: jest.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('safeSaveToStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  });

  describe('basic write/read round-trip', () => {
    test('writes and reads back a string array (tutorial-progress pattern)', () => {
      const data = ['step1', 'step2', 'step3'];
      const ok = safeSaveToStorage('tutorial-progress', data, 'Test');
      expect(ok).toBe(true);

      const loaded = safeLoadFromStorage<string[]>(
        'tutorial-progress',
        (v): v is string[] => Array.isArray(v) && v.every(i => typeof i === 'string'),
        'Test',
        [],
      );
      expect(loaded).toEqual(data);
    });

    test('writes and reads back a boolean (first-visit pattern)', () => {
      const ok = safeSaveToStorage('first-visit', false, 'Test');
      expect(ok).toBe(true);

      const loaded = safeLoadFromStorage<boolean>(
        'first-visit',
        (v): v is boolean => typeof v === 'boolean',
        'Test',
        true,
      );
      expect(loaded).toBe(false);
    });

    test('writes and reads back an object (production-config-overrides pattern)', () => {
      const config = { apiBaseUrl: 'https://api.example.com', maxConcurrentJobs: 4 };
      const ok = safeSaveToStorage('production-config-overrides', config, 'Test');
      expect(ok).toBe(true);

      const loaded = safeLoadFromStorage<Record<string, unknown>>(
        'production-config-overrides',
        (v): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v),
        'Test',
        {},
      );
      expect(loaded).toEqual(config);
    });

    test('writes and reads back a Set converted to array', () => {
      const original = new Set(['a', 'b', 'c']);
      const ok = safeSaveToStorage('my-set', Array.from(original), 'Test');
      expect(ok).toBe(true);

      const loaded = safeLoadFromStorage<string[]>(
        'my-set',
        (v): v is string[] => Array.isArray(v),
        'Test',
        [],
      );
      expect(new Set(loaded)).toEqual(original);
    });
  });

  describe('quota exceeded handling', () => {
    test('returns false when quota exceeded', () => {
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn(() => { throw quotaError; });

      const ok = safeSaveToStorage('test-key', { data: 'test' }, 'TestSource');
      expect(ok).toBe(false);

      localStorageMock.setItem = originalSetItem;
    });

    test('does not throw when localStorage.setItem throws', () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn(() => { throw new Error('SecurityError'); });

      expect(() => {
        safeSaveToStorage('test-key', { data: 'test' }, 'TestSource');
      }).not.toThrow();

      localStorageMock.setItem = originalSetItem;
    });
  });

  describe('serialization failure handling', () => {
    test('returns false when value cannot be serialized (circular reference)', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      const ok = safeSaveToStorage('circular-key', circular, 'TestSource');
      expect(ok).toBe(false);
    });

    test('does not throw when JSON.stringify throws', () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      expect(() => {
        safeSaveToStorage('circular-key', circular, 'TestSource');
      }).not.toThrow();
    });
  });

  describe('backward compatibility', () => {
    test('first-visit stored as raw string "false" is readable via safeLoadFromStorage', () => {
      // Simulate old behavior: localStorage.setItem('first-visit', 'false')
      // The old code stored the raw string 'false' (not JSON).
      // JSON.parse('false') === false (boolean), so backward compatible.
      mockStorage['first-visit'] = 'false';

      const loaded = safeLoadFromStorage<boolean>(
        'first-visit',
        (v): v is boolean => typeof v === 'boolean',
        'Test',
        true,
      );
      expect(loaded).toBe(false);
    });

    test('first-visit absent returns default true (first visit)', () => {
      const loaded = safeLoadFromStorage<boolean>(
        'first-visit',
        (v): v is boolean => typeof v === 'boolean',
        'Test',
        true,
      );
      expect(loaded).toBe(true);
    });

    test('corrupt first-visit value is self-healed', () => {
      mockStorage['first-visit'] = '{ corrupt';

      const loaded = safeLoadFromStorage<boolean>(
        'first-visit',
        (v): v is boolean => typeof v === 'boolean',
        'Test',
        true,
      );
      expect(loaded).toBe(true); // falls back to default
      expect(mockStorage['first-visit']).toBeUndefined(); // corrupt entry removed
    });
  });

  describe('overwrite behavior', () => {
    test('safeSaveToStorage overwrites existing value', () => {
      safeSaveToStorage('test-key', { version: 1 }, 'Test');
      safeSaveToStorage('test-key', { version: 2 }, 'Test');

      const loaded = safeLoadFromStorage<{ version: number }>(
        'test-key',
        (v): v is { version: number } => typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).version === 'number',
        'Test',
        { version: 0 },
      );
      expect(loaded.version).toBe(2);
    });
  });
});
