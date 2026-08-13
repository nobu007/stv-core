/**
 * Unit tests for ProductionConfigManager
 * Covers: environment configs, overrides, validation, optimization, performance reports
 */

import { ProductionConfigManager } from '../production-config';
import { logger } from '@/utils/logger';

// Mock logger. Includes setLevel/getLevel + LogLevel because updateConfig /
// resetConfig now propagate monitoring.logLevel to the logger (REQ-059); the
// real logger is exercised by production-config-loglevel-reaches-logger.test.ts.
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLevel: jest.fn(),
    getLevel: jest.fn(),
  },
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 },
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
  clear: jest.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock navigator
Object.defineProperty(globalThis, 'navigator', {
  value: { hardwareConcurrency: 8 },
  writable: true,
});

// Mock performance.memory
Object.defineProperty(globalThis, 'performance', {
  value: {
    ...globalThis.performance,
    memory: { jsHeapSizeLimit: 2048 * 1024 * 1024 },
  },
  writable: true,
});

describe('ProductionConfigManager', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    originalNodeEnv = process.env.NODE_ENV;
    // Default to test env which falls back to development
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('getConfig', () => {
    it('returns development config by default', () => {
      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();
      expect(config.name).toBe('development');
      expect(config.apiBaseUrl).toContain('localhost');
    });

    it('returns production config when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();
      expect(config.name).toBe('production');
      expect(config.apiBaseUrl).toContain('api.example.com');
    });

    it('returns staging config when NODE_ENV=staging', () => {
      process.env.NODE_ENV = 'staging';
      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();
      expect(config.name).toBe('staging');
    });

    it('falls back to development for unknown env', () => {
      process.env.NODE_ENV = 'unknown-env';
      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();
      expect(config.name).toBe('development');
    });

    it('includes all required config sections', () => {
      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();
      expect(config.features).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.monitoring).toBeDefined();
      expect(config.export).toBeDefined();
    });
  });

  describe('feature flags by environment', () => {
    it('development has experimental features enabled', () => {
      process.env.NODE_ENV = 'development';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().features.experimentalFeatures).toBe(true);
    });

    it('production has experimental features disabled', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().features.experimentalFeatures).toBe(false);
    });

    it('production has enterprise features enabled', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().features.enterpriseFeatures).toBe(true);
    });

    it('development does not have collaborative editing', () => {
      process.env.NODE_ENV = 'development';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().features.collaborativeEditing).toBe(false);
    });
  });

  describe('quality presets by environment', () => {
    it('development has 3 presets', () => {
      process.env.NODE_ENV = 'development';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().export.qualityPresets).toHaveLength(3);
    });

    it('production has 5 presets (includes 4K and GIF)', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      const presets = mgr.getConfig().export.qualityPresets;
      expect(presets).toHaveLength(5);
      expect(presets.some(p => p.name === '4K')).toBe(true);
      expect(presets.some(p => p.name === 'GIF')).toBe(true);
    });
  });

  describe('performance config by environment', () => {
    it('development allows 2 concurrent jobs', () => {
      process.env.NODE_ENV = 'development';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().performance.maxConcurrentJobs).toBe(2);
    });

    it('production allows 10 concurrent jobs', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().performance.maxConcurrentJobs).toBe(10);
    });

    it('production uses redis cache strategy', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().performance.cacheStrategy).toBe('redis');
    });

    it('production has aggressive optimization level', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().performance.optimizationLevel).toBe('aggressive');
    });
  });

  describe('updateConfig', () => {
    it('applies partial overrides', () => {
      const mgr = new ProductionConfigManager();
      mgr.updateConfig({ apiBaseUrl: 'http://custom:9999/api' });
      expect(mgr.getConfig().apiBaseUrl).toBe('http://custom:9999/api');
    });

    it('persists overrides to localStorage', () => {
      const mgr = new ProductionConfigManager();
      mgr.updateConfig({ apiBaseUrl: 'http://test/api' });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'production-config-overrides',
        expect.any(String)
      );
    });

    it('merges nested overrides correctly', () => {
      const mgr = new ProductionConfigManager();
      const originalTimeout = mgr.getConfig().performance.timeoutMs;
      mgr.updateConfig({
        performance: { maxConcurrentJobs: 99 } as any
      });
      const config = mgr.getConfig();
      expect(config.performance.maxConcurrentJobs).toBe(99);
      // Other performance fields should be preserved from base config
      expect(config.performance.timeoutMs).toBe(originalTimeout);
    });
  });

  describe('resetConfig', () => {
    it('clears overrides', () => {
      const mgr = new ProductionConfigManager();
      mgr.updateConfig({ apiBaseUrl: 'http://overridden/api' });
      mgr.resetConfig();
      // Should be back to env default
      expect(mgr.getConfig().apiBaseUrl).toContain('localhost');
    });

    it('removes from localStorage', () => {
      const mgr = new ProductionConfigManager();
      mgr.resetConfig();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });
  });

  describe('validateConfig', () => {
    it('returns valid for default development config', () => {
      const mgr = new ProductionConfigManager();
      const result = mgr.validateConfig();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for default production config', () => {
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      const result = mgr.validateConfig();
      expect(result.isValid).toBe(true);
    });

    it('detects invalid maxConcurrentJobs', () => {
      const mgr = new ProductionConfigManager();
      mgr.updateConfig({
        performance: { maxConcurrentJobs: 0 } as any
      });
      const result = mgr.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max concurrent jobs must be at least 1');
    });

    it('detects invalid timeout', () => {
      const mgr = new ProductionConfigManager();
      mgr.updateConfig({
        performance: { timeoutMs: 1000 } as any
      });
      const result = mgr.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Timeout'))).toBe(true);
    });

    it('detects invalid concurrent exports', () => {
      const mgr = new ProductionConfigManager();
      mgr.updateConfig({
        export: { concurrentExports: 0 } as any
      });
      const result = mgr.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Concurrent exports'))).toBe(true);
    });
  });

  describe('getOptimizedConfig', () => {
    it('returns config adjusted for system capabilities', () => {
      const mgr = new ProductionConfigManager();
      const optimized = mgr.getOptimizedConfig();
      expect(optimized).toBeDefined();
      expect(optimized.name).toBeDefined();
    });

    it('limits jobs for low-memory systems', () => {
      // Mock low memory
      Object.defineProperty(globalThis.performance, 'memory', {
        value: { jsHeapSizeLimit: 512 * 1024 * 1024 },
        writable: true,
      });
      const mgr = new ProductionConfigManager();
      const optimized = mgr.getOptimizedConfig();
      // With 512MB memory, should limit concurrent jobs
      expect(optimized.performance.maxConcurrentJobs).toBeLessThanOrEqual(2);
      // Restore
      Object.defineProperty(globalThis.performance, 'memory', {
        value: { jsHeapSizeLimit: 2048 * 1024 * 1024 },
        writable: true,
      });
    });

    it('limits exports for low-core systems', () => {
      // Mock low CPU
      Object.defineProperty(globalThis.navigator, 'hardwareConcurrency', {
        value: 2,
        writable: true,
      });
      const mgr = new ProductionConfigManager();
      const optimized = mgr.getOptimizedConfig();
      expect(optimized.export.concurrentExports).toBeLessThanOrEqual(2);
      // Restore
      Object.defineProperty(globalThis.navigator, 'hardwareConcurrency', {
        value: 8,
        writable: true,
      });
    });
  });

  describe('generatePerformanceReport', () => {
    it('returns complete report structure', () => {
      const mgr = new ProductionConfigManager();
      const report = mgr.generatePerformanceReport();
      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('systemInfo');
      expect(report).toHaveProperty('configValidation');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('includes config validation in report', () => {
      const mgr = new ProductionConfigManager();
      const report = mgr.generatePerformanceReport();
      expect(report.configValidation.isValid).toBeDefined();
    });

    it('recommends reducing memory when limit exceeds available', () => {
      // Mock low memory
      Object.defineProperty(globalThis.performance, 'memory', {
        value: { jsHeapSizeLimit: 256 * 1024 * 1024 },
        writable: true,
      });
      process.env.NODE_ENV = 'production';
      const mgr = new ProductionConfigManager();
      const report = mgr.generatePerformanceReport();
      expect(report.recommendations.some(r => r.includes('memory'))).toBe(true);
      // Restore
      Object.defineProperty(globalThis.performance, 'memory', {
        value: { jsHeapSizeLimit: 2048 * 1024 * 1024 },
        writable: true,
      });
    });
  });

  describe('env var overrides', () => {
    it('respects REACT_APP_MAX_CONCURRENT_JOBS', () => {
      process.env.REACT_APP_MAX_CONCURRENT_JOBS = '42';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().performance.maxConcurrentJobs).toBe(42);
      delete process.env.REACT_APP_MAX_CONCURRENT_JOBS;
    });

    it('respects REACT_APP_API_BASE_URL', () => {
      process.env.REACT_APP_API_BASE_URL = 'http://env-override/api';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().apiBaseUrl).toBe('http://env-override/api');
      delete process.env.REACT_APP_API_BASE_URL;
    });
  });

  // ── REQ-056: env-var numeric override must enforce the same finiteness
  // invariant as the localStorage restore boundary ──
  // configOverrides is fed by TWO boundaries: (1) localStorage restore, guarded
  // by validateConfigOverrides → isPositiveFiniteNumber (REQ-054); (2) env-var
  // injection in loadConfigOverrides, which used a raw parseInt. parseInt('abc')
  // → NaN, parseInt('-5') → -5, parseInt('0') → 0 all crossed the boundary into
  // getConfig() / getOptimizedConfig (Math.min(NaN, n) = NaN) unguarded — a
  // boundary-consistency gap where one boundary enforced the magnitude invariant
  // and the other did not. Both boundaries must agree.
  describe('env var override finiteness (boundary consistency with localStorage restore)', () => {
    let savedMaxConcurrent: string | undefined;

    beforeEach(() => {
      jest.clearAllMocks();
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      savedMaxConcurrent = process.env.REACT_APP_MAX_CONCURRENT_JOBS;
    });

    afterEach(() => {
      if (savedMaxConcurrent === undefined) {
        delete process.env.REACT_APP_MAX_CONCURRENT_JOBS;
      } else {
        process.env.REACT_APP_MAX_CONCURRENT_JOBS = savedMaxConcurrent;
      }
    });

    it.each([
      ['abc', 'non-numeric (parseInt→NaN)'],
      ['-5', 'negative'],
      ['0', 'zero (not a positive magnitude)'],
    ] as const)(
      'does NOT inject REACT_APP_MAX_CONCURRENT_JOBS=%p (%s); falls back to finite env default',
      (raw) => {
        process.env.REACT_APP_MAX_CONCURRENT_JOBS = raw;
        const mgr = new ProductionConfigManager();
        const value = mgr.getConfig().performance.maxConcurrentJobs;
        // Same invariant the localStorage boundary enforces: finite & positive.
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      },
    );

    it('still injects a valid finite positive env-var override', () => {
      process.env.REACT_APP_MAX_CONCURRENT_JOBS = '42';
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig().performance.maxConcurrentJobs).toBe(42);
    });
  });

  describe('localStorage type guard telemetry', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should warn when overrides contains an array instead of object', () => {
      mockStorage['production-config-overrides'] = JSON.stringify([1, 2, 3]);
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });

    it('should warn when overrides contains a string', () => {
      mockStorage['production-config-overrides'] = JSON.stringify('not-config');
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should warn when overrides contains a number', () => {
      mockStorage['production-config-overrides'] = JSON.stringify(42);
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should warn when overrides contains null', () => {
      mockStorage['production-config-overrides'] = JSON.stringify(null);
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });

    it('should accept a valid object and NOT warn about non-object', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: 'http://test/api' });
      const mgr = new ProductionConfigManager();
      const nonObjectWarnings = (logger.warn as jest.Mock).mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('failed type validation'),
      );
      expect(nonObjectWarnings).toHaveLength(0);
      expect(mgr.getConfig().apiBaseUrl).toBe('http://test/api');
    });

    it('should handle ALL-corrupted localStorage gracefully', () => {
      mockStorage['production-config-overrides'] = JSON.stringify([1, 2]);
      const mgr = new ProductionConfigManager();
      expect(mgr.getConfig()).toBeDefined();
      expect(mgr.getConfig().performance).toBeDefined();
    });
  });

  describe('malformed config field-level rejection', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should reject config with apiBaseUrl as number', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: 123 });
      const mgr = new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
      expect(mgr.getConfig().apiBaseUrl).toContain('localhost');
    });

    it('should reject config with apiBaseUrl as boolean', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: true });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should reject config with performance.maxConcurrentJobs as string', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        performance: { maxConcurrentJobs: 'not-a-number' },
      });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });

    it('should reject config with features as string', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ features: 'invalid' });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should reject config with features as null', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ features: null });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should reject config with performance as array', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ performance: [1, 2] });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should reject config with monitoring as number', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ monitoring: 42 });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should reject config with export as string', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ export: 'bad' });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should accept config with only apiBaseUrl as valid string', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: 'http://valid/api' });
      const mgr = new ProductionConfigManager();
      const malformedWarnings = (logger.warn as jest.Mock).mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('failed type validation'),
      );
      expect(malformedWarnings).toHaveLength(0);
      expect(mgr.getConfig().apiBaseUrl).toBe('http://valid/api');
    });

    it('should accept config with valid nested performance object', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        performance: { maxConcurrentJobs: 5, timeoutMs: 30000 },
      });
      const mgr = new ProductionConfigManager();
      const malformedWarnings = (logger.warn as jest.Mock).mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('failed type validation'),
      );
      expect(malformedWarnings).toHaveLength(0);
      expect(mgr.getConfig().performance.maxConcurrentJobs).toBe(5);
    });

    it('should reject config with maxFileSize as string', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        performance: { maxFileSize: 'large' },
      });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should reject config with timeoutMs as boolean', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        performance: { timeoutMs: true },
      });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should reject config with name as number', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ name: 123 });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
    });

    it('should handle multiple malformed fields and still reset', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        apiBaseUrl: 42,
        features: null,
        performance: 'bad',
      });
      new ProductionConfigManager();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed type validation'),
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });

    // ── Finiteness: Infinity/NaN/negative/zero must NOT survive localStorage restore ──
    // typeof === 'number' alone admits Infinity (JSON.parse overflow of 1e400) and
    // negatives straight into getConfig(), which then feed production-exporter
    // (maxConcurrentJobs) and parallel-layout-executor (timeoutMs). The raw payloads
    // below are injected as literal localStorage strings to exercise the real parse path.
    it.each([
      ['{"performance":{"maxConcurrentJobs":1e400}}', 'maxConcurrentJobs'],
      ['{"performance":{"timeoutMs":1e400}}', 'timeoutMs'],
      ['{"performance":{"maxFileSize":1e400}}', 'maxFileSize'],
      ['{"performance":{"maxConcurrentJobs":-5}}', 'maxConcurrentJobs'],
      ['{"performance":{"timeoutMs":-500}}', 'timeoutMs'],
      ['{"performance":{"maxFileSize":-1}}', 'maxFileSize'],
    ] as const)(
      'rejects non-finite/non-positive %s from raw localStorage payload (falls back to default)',
      (rawPayload, field) => {
        mockStorage['production-config-overrides'] = rawPayload;
        const mgr = new ProductionConfigManager();
        // Corruption is surfaced through safe-storage → reportCorruption → logger.warn
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('failed type validation'),
        );
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
        // Critical invariant: restored value is ALWAYS finite & positive, never
        // Infinity/-Infinity/NaN/negative, even under overflow or sign corruption.
        const restored = (mgr.getConfig().performance as Record<string, unknown>)[field];
        expect(Number.isFinite(restored)).toBe(true);
        expect(restored as number).toBeGreaterThan(0);
      },
    );

    // ── Finiteness tail (09y deferred sub-class): raw localStorage payload injection ──
    // monitoring/export were previously shape-only-validated (is-object), so a poisoned
    // payload survived JSON.parse and reached getConfig() — and round-trips back to
    // localStorage via ProductionDashboard.updateConfig. Injecting the raw string
    // exercises the real parse path end-to-end; the restored value must always fall
    // back to a finite, positive default. Same chokepoint (safe-storage) as 09y.
    it.each([
      ['{"performance":{"memoryLimit":1e400}}', ['performance', 'memoryLimit']],
      ['{"performance":{"memoryLimit":-512}}', ['performance', 'memoryLimit']],
      ['{"monitoring":{"metricsCollectionInterval":1e400}}', ['monitoring', 'metricsCollectionInterval']],
      ['{"monitoring":{"metricsCollectionInterval":-5}}', ['monitoring', 'metricsCollectionInterval']],
      ['{"monitoring":{"alertThresholds":{"errorRate":1e400}}}', ['monitoring', 'alertThresholds', 'errorRate']],
      ['{"monitoring":{"alertThresholds":{"responseTime":1e400}}}', ['monitoring', 'alertThresholds', 'responseTime']],
      ['{"monitoring":{"alertThresholds":{"memoryUsage":1e400}}}', ['monitoring', 'alertThresholds', 'memoryUsage']],
      ['{"export":{"concurrentExports":1e400}}', ['export', 'concurrentExports']],
      ['{"export":{"concurrentExports":-1}}', ['export', 'concurrentExports']],
    ] as const)(
      'rejects non-finite/non-positive inner numeric from raw payload (restores finite default)',
      (rawPayload, path) => {
        mockStorage['production-config-overrides'] = rawPayload;
        const mgr = new ProductionConfigManager();
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('failed type validation'),
        );
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
        const restored = (path as readonly string[]).reduce<unknown>(
          (o, k) => (o as Record<string, unknown>)[k],
          mgr.getConfig(),
        );
        expect(Number.isFinite(restored)).toBe(true);
        expect(restored as number).toBeGreaterThan(0);
      },
    );

    // ── Finiteness tail (qualityPresets inner numerics): raw localStorage payload ──
    // qualityPresets is the only remaining array-of-object numeric shape in the
    // persisted config; its width/height/fps/quality round-trip through
    // ProductionDashboard.updateConfig and drive canvas dims, frame counts, and
    // pixel allocations in production-exporter (Infinity → infinite-frame loop /
    // OOM, NaN → NaN propagation). A poisoned inner numeric (e.g. 1e400 overflow
    // → Infinity) must be rejected at the safe-storage chokepoint so it never
    // reaches getConfig() nor persists back to localStorage. Exercises the real
    // parse path end-to-end. Same chokepoint + class as 09y/09z.
    it.each([
      '{"export":{"qualityPresets":[{"name":"p","width":1e400,"height":720,"fps":30,"bitrate":"1M","quality":8,"targetUse":"u"}]}}',
      '{"export":{"qualityPresets":[{"name":"p","width":1280,"height":720,"fps":1e400,"bitrate":"1M","quality":8,"targetUse":"u"}]}}',
      '{"export":{"qualityPresets":[{"name":"p","width":1280,"height":720,"fps":30,"bitrate":"1M","quality":-5,"targetUse":"u"}]}}',
    ] as const)(
      'rejects non-finite/non-positive qualityPresets numeric from raw payload (restores finite defaults)',
      (rawPayload) => {
        mockStorage['production-config-overrides'] = rawPayload;
        const mgr = new ProductionConfigManager();
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('failed type validation'),
        );
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
        // Restored presets are the env defaults — every inner numeric finite & positive.
        for (const p of mgr.getConfig().export.qualityPresets) {
          expect(Number.isFinite(p.width) && p.width > 0).toBe(true);
          expect(Number.isFinite(p.height) && p.height > 0).toBe(true);
          expect(Number.isFinite(p.fps) && p.fps > 0).toBe(true);
          expect(Number.isFinite(p.quality) && p.quality > 0).toBe(true);
        }
      },
    );
  });

  // ── Direct validateConfigOverrides boolean-return tests ──
  // The feedback asks for tests that assert the guard *returns false* for
  // malformed configs, not just that a valid config passes.
  describe('validateConfigOverrides direct boolean assertion', () => {
    it('returns true for empty object', () => {
      expect(ProductionConfigManager.validateConfigOverrides({})).toBe(true);
    });

    it('returns true for valid apiBaseUrl string', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ apiBaseUrl: 'http://test/api' })).toBe(true);
    });

    it('returns false for apiBaseUrl as number', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ apiBaseUrl: 42 })).toBe(false);
    });

    it('returns false for apiBaseUrl as boolean', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ apiBaseUrl: true })).toBe(false);
    });

    it('returns false for name as number', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ name: 123 })).toBe(false);
    });

    it('returns false for features as string', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ features: 'bad' })).toBe(false);
    });

    it('returns false for features as null', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ features: null })).toBe(false);
    });

    it('returns false for features as array', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ features: [1, 2] })).toBe(false);
    });

    it('returns true for features as plain object', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ features: { flag: true } })).toBe(true);
    });

    it('returns false for performance as string', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ performance: 'fast' })).toBe(false);
    });

    it('returns false for performance as null', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ performance: null })).toBe(false);
    });

    it('returns false for performance as array', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ performance: [] })).toBe(false);
    });

    it('returns false for performance.maxConcurrentJobs as string', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        performance: { maxConcurrentJobs: 'five' },
      })).toBe(false);
    });

    it('returns false for performance.timeoutMs as boolean', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        performance: { timeoutMs: false },
      })).toBe(false);
    });

    it('returns false for performance.maxFileSize as string', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        performance: { maxFileSize: 'large' },
      })).toBe(false);
    });

    it('returns true for valid performance object', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        performance: { maxConcurrentJobs: 4, timeoutMs: 30000, maxFileSize: 100 },
      })).toBe(true);
    });

    // ── Finiteness: typeof === 'number' is insufficient ──
    // Infinity/NaN/≤0 must be rejected for magnitude-style numeric fields, else they
    // pass the type-guard and get applied as production config. (NaN is not reachable
    // via JSON.parse of valid JSON, but is defended against at the predicate contract.)
    it.each([
      ['maxConcurrentJobs', Infinity],
      ['maxConcurrentJobs', -Infinity],
      ['maxConcurrentJobs', NaN],
      ['maxConcurrentJobs', -1],
      ['maxConcurrentJobs', 0],
      ['timeoutMs', Infinity],
      ['timeoutMs', NaN],
      ['timeoutMs', -1],
      ['timeoutMs', 0],
      ['maxFileSize', Infinity],
      ['maxFileSize', NaN],
      ['maxFileSize', -1],
      ['maxFileSize', 0],
    ] as const)(
      'returns false for performance.%s = %p (non-finite or non-positive)',
      (field, value) => {
        expect(
          ProductionConfigManager.validateConfigOverrides({ performance: { [field]: value } }),
        ).toBe(false);
      },
    );

    // ── Finiteness tail (09y deferred sub-class): monitoring / export / memoryLimit ──
    // These sections were previously shape-only (is-object), so Infinity/NaN/negative
    // inner numerics passed the guard and flowed into getConfig(). Same isPositiveFiniteNumber
    // predicate, same chokepoint — closes the remaining tail of the restore-finiteness class.
    it.each([
      ['performance.memoryLimit', Infinity],
      ['performance.memoryLimit', NaN],
      ['performance.memoryLimit', -1],
      ['performance.memoryLimit', 0],
      ['monitoring.metricsCollectionInterval', Infinity],
      ['monitoring.metricsCollectionInterval', NaN],
      ['monitoring.metricsCollectionInterval', -100],
      ['monitoring.metricsCollectionInterval', 0],
      ['monitoring.alertThresholds.errorRate', Infinity],
      ['monitoring.alertThresholds.errorRate', NaN],
      ['monitoring.alertThresholds.errorRate', -0.1],
      ['monitoring.alertThresholds.errorRate', 0],
      ['monitoring.alertThresholds.responseTime', Infinity],
      ['monitoring.alertThresholds.responseTime', NaN],
      ['monitoring.alertThresholds.responseTime', -1],
      ['monitoring.alertThresholds.responseTime', 0],
      ['monitoring.alertThresholds.memoryUsage', Infinity],
      ['monitoring.alertThresholds.memoryUsage', NaN],
      ['monitoring.alertThresholds.memoryUsage', -0.5],
      ['monitoring.alertThresholds.memoryUsage', 0],
      ['export.concurrentExports', Infinity],
      ['export.concurrentExports', NaN],
      ['export.concurrentExports', -1],
      ['export.concurrentExports', 0],
    ] as const)(
      'returns false for %s = %p (non-finite or non-positive)',
      (path, value) => {
        const obj: Record<string, unknown> = {};
        path.split('.').reduce<Record<string, unknown>>((node, key, i, keys) => {
          if (i === keys.length - 1) {
            node[key] = value;
            return node;
          }
          const next: Record<string, unknown> = {};
          node[key] = next;
          return next;
        }, obj);
        expect(ProductionConfigManager.validateConfigOverrides(obj)).toBe(false);
      },
    );

    it('returns true for valid monitoring + export + memoryLimit numerics', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        performance: { memoryLimit: 1024 },
        monitoring: {
          metricsCollectionInterval: 5000,
          alertThresholds: { errorRate: 0.1, responseTime: 5000, memoryUsage: 0.8 },
        },
        export: { concurrentExports: 2 },
      })).toBe(true);
    });

    // ── Finiteness tail (qualityPresets inner numerics): array-of-object restore ──
    // qualityPresets is the only remaining array-of-object numeric in the persisted
    // config; its width/height/fps/quality drive canvas dims, frame counts, and pixel
    // allocations in production-exporter (Infinity → infinite-frame loop / OOM).
    it.each([
      ['width', Infinity],
      ['width', NaN],
      ['width', -100],
      ['width', 0],
      ['height', Infinity],
      ['height', NaN],
      ['height', -1],
      ['height', 0],
      ['fps', Infinity],
      ['fps', NaN],
      ['fps', -30],
      ['fps', 0],
      ['quality', Infinity],
      ['quality', NaN],
      ['quality', -5],
      ['quality', 0],
    ] as const)(
      'returns false for export.qualityPresets[].%s = %p (non-finite or non-positive)',
      (field, value) => {
        const preset = {
          name: 'p', width: 1280, height: 720, fps: 30,
          bitrate: '1M', quality: 8, targetUse: 'u',
          [field]: value,
        };
        expect(
          ProductionConfigManager.validateConfigOverrides({ export: { qualityPresets: [preset] } }),
        ).toBe(false);
      },
    );

    it('returns false for export.qualityPresets as non-array', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        export: { qualityPresets: { width: 1280 } as unknown as unknown[] },
      })).toBe(false);
    });

    it('returns false for export.qualityPresets element as non-object', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        export: { qualityPresets: ['not-a-preset'] },
      })).toBe(false);
    });

    it('returns true for export.qualityPresets with all-finite-positive numerics', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        export: {
          qualityPresets: [{
            name: 'HD', width: 1280, height: 720, fps: 30,
            bitrate: '3M', quality: 8, targetUse: 'web',
          }],
        },
      })).toBe(true);
    });

    it('returns false for monitoring as number', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ monitoring: 42 })).toBe(false);
    });

    it('returns false for monitoring as null', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ monitoring: null })).toBe(false);
    });

    it('returns false for export as string', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ export: 'bad' })).toBe(false);
    });

    it('returns false for export as null', () => {
      expect(ProductionConfigManager.validateConfigOverrides({ export: null })).toBe(false);
    });

    it('returns false when multiple fields are malformed', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        apiBaseUrl: 42,
        features: null,
        performance: 'bad',
        monitoring: 42,
        export: 'bad',
      })).toBe(false);
    });

    it('returns true for fully valid config with all fields', () => {
      expect(ProductionConfigManager.validateConfigOverrides({
        apiBaseUrl: 'http://api.example.com',
        name: 'production',
        features: { enableX: true },
        performance: { maxConcurrentJobs: 8, timeoutMs: 60000, maxFileSize: 500 },
        monitoring: { enabled: true },
        export: { format: 'mp4' },
      })).toBe(true);
    });
  });

  // ── getEnvVar error logging (silent catch → logger.warn) ──
  describe('getEnvVar error logging', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should call logger.warn when process.env access throws', () => {
      const descriptor = Object.getOwnPropertyDescriptor(process, 'env');
      Object.defineProperty(process, 'env', {
        get() { throw new Error('env access denied'); },
        configurable: true,
      });

      try {
        new ProductionConfigManager();
        const envWarnings = (logger.warn as jest.Mock).mock.calls.filter(
          (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('production-config'),
        );
        expect(envWarnings.length).toBeGreaterThan(0);
      } finally {
        if (descriptor) {
          Object.defineProperty(process, 'env', descriptor);
        }
      }
    });

    it('should not call logger.warn on normal env access', () => {
      new ProductionConfigManager();
      const envWarnings = (logger.warn as jest.Mock).mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('production-config'),
      );
      expect(envWarnings).toHaveLength(0);
    });
  });
});
