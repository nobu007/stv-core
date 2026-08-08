/**
 * 🏭 Production Configuration Optimizer
 * Comprehensive production environment setup and optimization
 * Following custom instructions for production readiness enhancement
 */

import { logger } from '@/utils/logger';
import { safeLoadFromStorage, safeSaveToStorage } from '@/utils/safe-storage';
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

    // Check name type if present
    if ('name' in parsed && typeof parsed.name !== 'string') return false;

    // Check features shape if present
    if ('features' in parsed) {
      const f = parsed.features;
      if (f === null || typeof f !== 'object' || Array.isArray(f)) return false;
    }

    // Check performance shape if present
    if ('performance' in parsed) {
      const p = parsed.performance;
      if (p === null || typeof p !== 'object' || Array.isArray(p)) return false;
      if ('maxConcurrentJobs' in p && typeof (p as Record<string, unknown>).maxConcurrentJobs !== 'number') return false;
      if ('timeoutMs' in p && typeof (p as Record<string, unknown>).timeoutMs !== 'number') return false;
      if ('maxFileSize' in p && typeof (p as Record<string, unknown>).maxFileSize !== 'number') return false;
    }

    // Check monitoring shape if present
    if ('monitoring' in parsed) {
      const m = parsed.monitoring;
      if (m === null || typeof m !== 'object' || Array.isArray(m)) return false;
    }

    // Check export shape if present
    if ('export' in parsed) {
      const e = parsed.export;
      if (e === null || typeof e !== 'object' || Array.isArray(e)) return false;
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
      // Environment variable overrides (ISS-012: browser-safe access)
      const maxConcurrent = ProductionConfigManager.getEnvVar('REACT_APP_MAX_CONCURRENT_JOBS');
      if (maxConcurrent) {
        this.configOverrides.performance = {
          ...this.configOverrides.performance,
          maxConcurrentJobs: parseInt(maxConcurrent)
        };
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
    try {
      localStorage.removeItem('production-config-overrides');
    } catch (error) {
      // localStorage may be unavailable in private browsing or restricted environments
      logger.warn('Failed to clear configuration overrides:', error);
    }
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