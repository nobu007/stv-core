/**
 * Unit tests for ProductionConfigManager
 * Covers: environment configs, overrides, validation, optimization, performance reports
 */

import { ProductionConfigManager } from '../production-config';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
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

  describe('localStorage type guard telemetry', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should warn when overrides contains an array instead of object', () => {
      mockStorage['production-config-overrides'] = JSON.stringify([1, 2, 3]);
      new ProductionConfigManager();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-object'),
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });

    it('should warn when overrides contains a string', () => {
      mockStorage['production-config-overrides'] = JSON.stringify('not-config');
      new ProductionConfigManager();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-object'),
      );
    });

    it('should warn when overrides contains a number', () => {
      mockStorage['production-config-overrides'] = JSON.stringify(42);
      new ProductionConfigManager();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-object'),
      );
    });

    it('should warn when overrides contains null', () => {
      mockStorage['production-config-overrides'] = JSON.stringify(null);
      new ProductionConfigManager();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-object'),
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });

    it('should accept a valid object and NOT warn about non-object', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: 'http://test/api' });
      const mgr = new ProductionConfigManager();
      const nonObjectWarnings = warnSpy.mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('non-object'),
      );
      expect(nonObjectWarnings).toHaveLength(0);
      expect(mgr.getConfig().apiBaseUrl).toBe('http://test/api');
    });

    it('should handle ALL-corrupted localStorage gracefully', () => {
      // Set multiple corrupted entries
      mockStorage['production-config-overrides'] = JSON.stringify([1, 2]);
      // Constructor should not throw
      const mgr = new ProductionConfigManager();
      // Config should have default values
      expect(mgr.getConfig()).toBeDefined();
      expect(mgr.getConfig().performance).toBeDefined();
    });
  });
});
