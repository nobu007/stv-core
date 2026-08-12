/**
 * 🏭 Production Configuration Optimizer
 * Comprehensive production environment setup and optimization
 * Following custom instructions for production readiness enhancement
 */

import { logger } from '@/utils/logger';
import { safeLoadFromStorage, safeRemoveFromStorage, safeSaveToStorage } from '@/utils/safe-storage';
import { bytesToMb } from '@/lib/metrics-utils';

export interface ProductionEnvironment {
  name: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
  features: FeatureFlags;
  performance: PerformanceConfig;
  monitoring: MonitoringConfig;
  export: ExportConfig;
}

export interface FeatureFlags {
  realTimeProcessing: boolean;
  advancedAnalytics: boolean;
  multiLanguageSupport: boolean;
  batchProcessing: boolean;
  collaborativeEditing: boolean;
  enterpriseFeatures: boolean;
  experimentalFeatures: boolean;
}

export interface PerformanceConfig {
  maxConcurrentJobs: number;
  maxFileSize: number; // in bytes
  memoryLimit: number; // in MB
  timeoutMs: number;
  cacheStrategy: 'memory' | 'redis' | 'hybrid';
  enableCompression: boolean;
  optimizationLevel: 'basic' | 'standard' | 'aggressive';
}

export interface MonitoringConfig {
  enableErrorTracking: boolean;
  enablePerformanceMonitoring: boolean;
  enableUserAnalytics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  metricsCollectionInterval: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
  };
}

export interface ExportConfig {
  defaultFormat: 'mp4' | 'webm' | 'gif';
  qualityPresets: QualityPreset[];
  concurrentExports: number;
  compressionEnabled: boolean;
  watermarkEnabled: boolean;
}

export interface QualityPreset {
  name: string;
  width: number;
  height: number;
  fps: number;
  bitrate: string;
  quality: number;
  targetUse: string;
}

/**
 * A value that is a real, usable positive magnitude.
 *
 * `typeof === 'number'` alone admits `Infinity` (reachable from localStorage via
 * `JSON.parse` overflow of a literal like `1e400`), `-Infinity`, `NaN`, zero, and
 * negatives — all nonsensical for magnitude-style config fields (concurrency, size,
 * timeout) persisted to localStorage. Centralising the predicate keeps the operator
 * (+, finite, positivity) in one definition rather than re-deriving it per field.
 */
const isPositiveFiniteNumber = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * The closed set of string-literal-union (enum) fields exposed on the persisted
 * `ProductionEnvironment`, each mapped to its declared set of allowed literals.
 *
 * Single source of truth, read straight from the interface declarations above.
 * localStorage survives a `JSON.parse` round-trip, and a malicious or corrupted
 * payload can carry any string. `typeof === 'string'` admits an out-of-set value
 * (e.g. `logLevel: "trace"`, `defaultFormat: "exe"`, `name: "attacker"`) exactly
 * the way `typeof === 'number'` admits `Infinity` — so the value crosses the
 * restore boundary and reaches downstream consumers (ProductionDashboard,
 * logger setup, export format selection) that assume the enum invariant. Routing
 * every enum field through this one roster lets `validateConfigOverrides` reject
 * out-of-set values at the chokepoint, and lets the closed-set anchor
 * (`production-config-enum-exhaustive.test.ts`) prove — by reading this object
 * and the interface source — that every declared literal-union field is validated
 * and no roster entry is silently un-enforced. The numeric finiteness tail of the
 * same lifecycle is anchored by REQ-054; this is its enum twin.
 */
const PROD_CONFIG_ENUM_FIELDS: Readonly<Record<string, readonly string[]>> = {
  name: ['development', 'staging', 'production'],
  cacheStrategy: ['memory', 'redis', 'hybrid'],
  optimizationLevel: ['basic', 'standard', 'aggressive'],
  logLevel: ['error', 'warn', 'info', 'debug'],
  defaultFormat: ['mp4', 'webm', 'gif'],
};

const isAllowedEnumValue = (value: unknown, allowed: readonly string[]): boolean =>
  typeof value === 'string' && allowed.includes(value);

export class ProductionConfigManager {
  private currentEnv: ProductionEnvironment;
  private configOverrides: Partial<ProductionEnvironment> = {};

  /**
   * Safely access process.env in environments where `process` may be undefined
   * (e.g. browser builds where Vite does not statically replace env vars).
   */
  private static getEnvVar(key: string): string | undefined {
    try {
      return (typeof process !== 'undefined' && process.env) ? process.env[key] : undefined;
    } catch (err) {
      logger.warn(`[production-config] process.env access failed for key "${key}"`, err);
      return undefined;
    }
  }

  /**
   * Safely get NODE_ENV with browser-compatible fallback (ISS-012)
   */
  private static getNodeEnv(): string {
    return ProductionConfigManager.getEnvVar('NODE_ENV') || 'development';
  }

  constructor() {
    this.currentEnv = this.getEnvironmentConfig();
    this.loadConfigOverrides();
  }

  /**
   * Get environment-specific configuration
   */
  private getEnvironmentConfig(): ProductionEnvironment {
    const env = ProductionConfigManager.getNodeEnv() as ProductionEnvironment['name'];

    const configs: Record<ProductionEnvironment['name'], ProductionEnvironment> = {
      development: {
        name: 'development',
        apiBaseUrl: 'http://localhost:3000/api',
        features: {
          realTimeProcessing: true,
          advancedAnalytics: false,
          multiLanguageSupport: true,
          batchProcessing: true,
          collaborativeEditing: false,
          enterpriseFeatures: false,
          experimentalFeatures: true
        },
        performance: {
          maxConcurrentJobs: 2,
          maxFileSize: 50 * 1024 * 1024, // 50MB
          memoryLimit: 512,
          timeoutMs: 60000,
          cacheStrategy: 'memory',
          enableCompression: false,
          optimizationLevel: 'basic'
        },
        monitoring: {
          enableErrorTracking: true,
          enablePerformanceMonitoring: true,
          enableUserAnalytics: false,
          logLevel: 'debug',
          metricsCollectionInterval: 5000,
          alertThresholds: {
            errorRate: 0.1,
            responseTime: 5000,
            memoryUsage: 0.8
          }
        },
        export: {
          defaultFormat: 'mp4',
          qualityPresets: this.getQualityPresets('development'),
          concurrentExports: 1,
          compressionEnabled: false,
          watermarkEnabled: false
        }
      },

      staging: {
        name: 'staging',
        apiBaseUrl: 'https://staging-api.example.com/api',
        features: {
          realTimeProcessing: true,
          advancedAnalytics: true,
          multiLanguageSupport: true,
          batchProcessing: true,
          collaborativeEditing: true,
          enterpriseFeatures: true,
          experimentalFeatures: false
        },
        performance: {
          maxConcurrentJobs: 5,
          maxFileSize: 100 * 1024 * 1024, // 100MB
          memoryLimit: 1024,
          timeoutMs: 120000,
          cacheStrategy: 'hybrid',
          enableCompression: true,
          optimizationLevel: 'standard'
        },
        monitoring: {
          enableErrorTracking: true,
          enablePerformanceMonitoring: true,
          enableUserAnalytics: true,
          logLevel: 'info',
          metricsCollectionInterval: 10000,
          alertThresholds: {
            errorRate: 0.05,
            responseTime: 3000,
            memoryUsage: 0.75
          }
        },
        export: {
          defaultFormat: 'mp4',
          qualityPresets: this.getQualityPresets('staging'),
          concurrentExports: 3,
          compressionEnabled: true,
          watermarkEnabled: true
        }
      },

      production: {
        name: 'production',
        apiBaseUrl: 'https://api.example.com/api',
        features: {
          realTimeProcessing: true,
          advancedAnalytics: true,
          multiLanguageSupport: true,
          batchProcessing: true,
          collaborativeEditing: true,
          enterpriseFeatures: true,
          experimentalFeatures: false
        },
        performance: {
          maxConcurrentJobs: 10,
          maxFileSize: 200 * 1024 * 1024, // 200MB
          memoryLimit: 2048,
          timeoutMs: 300000,
          cacheStrategy: 'redis',
          enableCompression: true,
          optimizationLevel: 'aggressive'
        },
        monitoring: {
          enableErrorTracking: true,
          enablePerformanceMonitoring: true,
          enableUserAnalytics: true,
          logLevel: 'warn',
          metricsCollectionInterval: 30000,
          alertThresholds: {
            errorRate: 0.01,
            responseTime: 2000,
            memoryUsage: 0.7
          }
        },
        export: {
          defaultFormat: 'mp4',
          qualityPresets: this.getQualityPresets('production'),
          concurrentExports: 5,
          compressionEnabled: true,
          watermarkEnabled: false
        }
      }
    };

    return configs[env] || configs.development;
  }

  /**
   * Get quality presets for different environments
   */
  private getQualityPresets(env: string): QualityPreset[] {
    const basePresets: QualityPreset[] = [
      {
        name: 'Mobile',
        width: 720,
        height: 480,
        fps: 24,
        bitrate: '1M',
        quality: 7,
        targetUse: 'Mobile devices and low bandwidth'
      },
      {
        name: 'Web HD',
        width: 1280,
        height: 720,
        fps: 30,
        bitrate: '3M',
        quality: 8,
        targetUse: 'Web streaming and social media'
      },
      {
        name: 'Full HD',
        width: 1920,
        height: 1080,
        fps: 30,
        bitrate: '6M',
        quality: 9,
        targetUse: 'High-quality presentations'
      }
    ];

    if (env === 'production') {
      basePresets.push(
        {
          name: '4K',
          width: 3840,
          height: 2160,
          fps: 30,
          bitrate: '20M',
          quality: 10,
          targetUse: 'Ultra-high quality export'
        },
        {
          name: 'GIF',
          width: 800,
          height: 600,
          fps: 12,
          bitrate: '500K',
          quality: 6,
          targetUse: 'Animated GIF for demos'
        }
      );
    }

    return basePresets;
  }

  /**
   * Validate that a parsed overrides object has correct field types.
   * Returns true if the shape is safe to use as Partial<ProductionEnvironment>.
   *
   * Public so that tests can directly assert rejection of malformed configs.
   */
  static validateConfigOverrides(parsed: Record<string, unknown>): boolean {
    // Check apiBaseUrl type if present
    if ('apiBaseUrl' in parsed && typeof parsed.apiBaseUrl !== 'string') return false;

    // Check name type + declared environment set if present
    if ('name' in parsed && !isAllowedEnumValue(parsed.name, PROD_CONFIG_ENUM_FIELDS.name)) return false;

    // Check features shape if present
    if ('features' in parsed) {
      const f = parsed.features;
      if (f === null || typeof f !== 'object' || Array.isArray(f)) return false;
    }

    // Check performance shape if present
    if ('performance' in parsed) {
      const p = parsed.performance;
      if (p === null || typeof p !== 'object' || Array.isArray(p)) return false;
      const perf = p as Record<string, unknown>;
      if ('maxConcurrentJobs' in perf && !isPositiveFiniteNumber(perf.maxConcurrentJobs)) return false;
      if ('timeoutMs' in perf && !isPositiveFiniteNumber(perf.timeoutMs)) return false;
      if ('maxFileSize' in perf && !isPositiveFiniteNumber(perf.maxFileSize)) return false;
      if ('memoryLimit' in perf && !isPositiveFiniteNumber(perf.memoryLimit)) return false;
      if ('cacheStrategy' in perf && !isAllowedEnumValue(perf.cacheStrategy, PROD_CONFIG_ENUM_FIELDS.cacheStrategy)) return false;
      if ('optimizationLevel' in perf && !isAllowedEnumValue(perf.optimizationLevel, PROD_CONFIG_ENUM_FIELDS.optimizationLevel)) return false;
    }

    // Check monitoring shape if present
    if ('monitoring' in parsed) {
      const m = parsed.monitoring;
      if (m === null || typeof m !== 'object' || Array.isArray(m)) return false;
      const mon = m as Record<string, unknown>;
      if ('metricsCollectionInterval' in mon && !isPositiveFiniteNumber(mon.metricsCollectionInterval)) return false;
      if ('logLevel' in mon && !isAllowedEnumValue(mon.logLevel, PROD_CONFIG_ENUM_FIELDS.logLevel)) return false;
      // alertThresholds are magnitude/ratio numerics that drive alerting decisions and
      // round-trip through ProductionDashboard; validate finiteness per field (not just shape).
      if ('alertThresholds' in mon) {
        const at = mon.alertThresholds;
        if (at === null || typeof at !== 'object' || Array.isArray(at)) return false;
        const thresholds = at as Record<string, unknown>;
        if ('errorRate' in thresholds && !isPositiveFiniteNumber(thresholds.errorRate)) return false;
        if ('responseTime' in thresholds && !isPositiveFiniteNumber(thresholds.responseTime)) return false;
        if ('memoryUsage' in thresholds && !isPositiveFiniteNumber(thresholds.memoryUsage)) return false;
      }
    }

    // Check export shape if present
    if ('export' in parsed) {
      const e = parsed.export;
      if (e === null || typeof e !== 'object' || Array.isArray(e)) return false;
      const exp = e as Record<string, unknown>;
      if ('concurrentExports' in exp && !isPositiveFiniteNumber(exp.concurrentExports)) return false;
      if ('defaultFormat' in exp && !isAllowedEnumValue(exp.defaultFormat, PROD_CONFIG_ENUM_FIELDS.defaultFormat)) return false;
      // qualityPresets inner numerics (width/height/fps/quality) are magnitude fields that
      // round-trip through ProductionDashboard.updateConfig and drive canvas dimensions, frame
      // counts, and pixel allocations downstream (production-exporter: `sceneDuration * fps`
      // → frame loop, `width * height` → pixel buffer). Infinity/NaN/≤0 survive a bare
      // `typeof === 'number'` (JSON.parse overflow of a 1e400 literal yields Infinity) and
      // would cause infinite-frame loops / NaN propagation / OOM. Same isPositiveFiniteNumber
      // predicate + chokepoint as the scalar finiteness tail (09y/09z); closes the last
      // array-of-object numeric in the persisted config.
      if ('qualityPresets' in exp) {
        const qp = exp.qualityPresets;
        if (!Array.isArray(qp)) return false;
        for (const preset of qp) {
          if (preset === null || typeof preset !== 'object' || Array.isArray(preset)) return false;
          const p = preset as Record<string, unknown>;
          if ('width' in p && !isPositiveFiniteNumber(p.width)) return false;
          if ('height' in p && !isPositiveFiniteNumber(p.height)) return false;
          if ('fps' in p && !isPositiveFiniteNumber(p.fps)) return false;
          if ('quality' in p && !isPositiveFiniteNumber(p.quality)) return false;
        }
      }
    }

    return true;
  }

  /**
   * Load configuration overrides from localStorage or environment
   */
  private loadConfigOverrides(): void {
    const parsed = safeLoadFromStorage(
      'production-config-overrides',
      (v): v is Record<string, unknown> =>
        v !== null && typeof v === 'object' && !Array.isArray(v) &&
        ProductionConfigManager.validateConfigOverrides(v as Record<string, unknown>),
      'ProductionConfig',
      {} as Record<string, unknown>,
    );
    if (Object.keys(parsed).length > 0) {
      this.configOverrides = parsed as Partial<ProductionEnvironment>;
    }

    try {
      // Environment variable overrides (ISS-012: browser-safe access).
      // Boundary consistency: `configOverrides` is fed by two boundaries —
      // localStorage restore (guarded by validateConfigOverrides →
      // isPositiveFiniteNumber, REQ-054) and this env-var injection. A raw
      // `parseInt` admitted NaN ('abc'), zero, and negatives straight into
      // getConfig() / getOptimizedConfig (Math.min(NaN, n) = NaN), bypassing
      // the chokepoint the other boundary enforces. Route the parsed value
      // through the SAME predicate so both boundaries agree; an invalid env
      // var is skipped (falls back to the env default), mirroring localStorage-
      // corruption handling. Structurally anchored by
      // production-config-env-boundary-exhaustive.test.ts (REQ-056).
      const maxConcurrent = ProductionConfigManager.getEnvVar('REACT_APP_MAX_CONCURRENT_JOBS');
      if (maxConcurrent) {
        const parsed = parseInt(maxConcurrent, 10);
        if (isPositiveFiniteNumber(parsed)) {
          this.configOverrides.performance = {
            ...this.configOverrides.performance,
            maxConcurrentJobs: parsed,
          };
        }
      }

      const apiBaseUrl = ProductionConfigManager.getEnvVar('REACT_APP_API_BASE_URL');
      if (apiBaseUrl) {
        this.configOverrides.apiBaseUrl = apiBaseUrl;
      }
    } catch (error) {
      logger.warn('Failed to load configuration overrides:', error);
    }
  }

  /**
   * Get the current configuration with overrides applied
   */
  getConfig(): ProductionEnvironment {
    return {
      ...this.currentEnv,
      ...this.configOverrides,
      features: {
        ...this.currentEnv.features,
        ...this.configOverrides.features
      },
      performance: {
        ...this.currentEnv.performance,
        ...this.configOverrides.performance
      },
      monitoring: {
        ...this.currentEnv.monitoring,
        ...this.configOverrides.monitoring
      },
      export: {
        ...this.currentEnv.export,
        ...this.configOverrides.export
      }
    };
  }

  /**
   * Update configuration with overrides
   */
  updateConfig(overrides: Partial<ProductionEnvironment>): void {
    this.configOverrides = {
      ...this.configOverrides,
      ...overrides
    };

    safeSaveToStorage('production-config-overrides', this.configOverrides, 'ProductionConfigManager');
  }

  /**
   * Reset configuration to environment defaults
   */
  resetConfig(): void {
    this.configOverrides = {};
    // Route through the chokepoint so private-mode / restricted-env failures
    // surface as a corruption report (consistent with load/save) instead of
    // a duplicated try/catch + logger.warn here. If the chokepoint is ever
    // weakened, the structural guard at tests/guards/raw-localstorage-remove-
    // chokepoint.test.ts (TC-315) fires.
    safeRemoveFromStorage('production-config-overrides', 'ProductionConfigManager.resetConfig');
  }

  /**
   * Validate current configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const config = this.getConfig();
    const errors: string[] = [];

    // Validate performance settings
    if (config.performance.maxConcurrentJobs < 1) {
      errors.push('Max concurrent jobs must be at least 1');
    }

    if (config.performance.maxFileSize < 1024 * 1024) {
      errors.push('Max file size must be at least 1MB');
    }

    if (config.performance.timeoutMs < 10000) {
      errors.push('Timeout must be at least 10 seconds');
    }

    // Validate monitoring settings
    if (config.monitoring.metricsCollectionInterval < 1000) {
      errors.push('Metrics collection interval must be at least 1 second');
    }

    // Validate export settings
    if (config.export.concurrentExports < 1) {
      errors.push('Concurrent exports must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get optimized configuration for current system capabilities
   */
  getOptimizedConfig(): ProductionEnvironment {
    const config = this.getConfig();
    const systemInfo = this.getSystemInfo();

    // Adjust based on system capabilities
    if (systemInfo.availableMemory < 1024) {
      config.performance.maxConcurrentJobs = Math.min(config.performance.maxConcurrentJobs, 2);
      config.performance.memoryLimit = systemInfo.availableMemory * 0.7;
    }

    if (systemInfo.cpuCores < 4) {
      config.export.concurrentExports = Math.min(config.export.concurrentExports, 2);
    }

    return config;
  }

  /**
   * Get basic system information for optimization
   */
  private getSystemInfo(): { availableMemory: number; cpuCores: number } {
    try {
      // Estimate available memory (browser limitation)
      const memoryInfo = (performance as unknown as { memory?: { jsHeapSizeLimit: number } }).memory;
      const estimatedMemory = memoryInfo ?
        Math.round(bytesToMb(memoryInfo.jsHeapSizeLimit)) :
        1024; // Default to 1GB

      // Estimate CPU cores
      const cpuCores = navigator.hardwareConcurrency || 4;

      return {
        availableMemory: estimatedMemory,
        cpuCores
      };
    } catch (error) {
      logger.warn('[ProductionConfig] Failed to gather system info, using defaults:', error);
      return {
        availableMemory: 1024,
        cpuCores: 4
      };
    }
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    environment: string;
    systemInfo: ReturnType<typeof this.getSystemInfo>;
    configValidation: ReturnType<typeof this.validateConfig>;
    recommendations: string[];
  } {
    const config = this.getConfig();
    const systemInfo = this.getSystemInfo();
    const validation = this.validateConfig();
    const recommendations: string[] = [];

    // Generate recommendations
    if (systemInfo.availableMemory < config.performance.memoryLimit) {
      recommendations.push(`Reduce memory limit from ${config.performance.memoryLimit}MB to ${Math.round(systemInfo.availableMemory * 0.7)}MB`);
    }

    if (config.performance.maxConcurrentJobs > systemInfo.cpuCores) {
      recommendations.push(`Reduce concurrent jobs from ${config.performance.maxConcurrentJobs} to ${systemInfo.cpuCores} (matches CPU cores)`);
    }

    if (config.name === 'production' && config.monitoring.logLevel === 'debug') {
      recommendations.push('Change log level from debug to warn for production');
    }

    return {
      environment: config.name,
      systemInfo,
      configValidation: validation,
      recommendations
    };
  }
}

// Singleton instance
export const productionConfig = new ProductionConfigManager();

// Export default configuration
export default productionConfig;