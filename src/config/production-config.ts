/**
 * 🏭 Production Configuration Optimizer
 * Comprehensive production environment setup and optimization
 * Following custom instructions for production readiness enhancement
 */

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

class ProductionConfigManager {
  private currentEnv: ProductionEnvironment;
  private configOverrides: Partial<ProductionEnvironment> = {};

  constructor() {
    this.currentEnv = this.getEnvironmentConfig();
    this.loadConfigOverrides();
  }

  /**
   * Get environment-specific configuration
   */
  private getEnvironmentConfig(): ProductionEnvironment {
    const env = (process.env.NODE_ENV || 'development') as ProductionEnvironment['name'];

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
   * Load configuration overrides from localStorage or environment
   */
  private loadConfigOverrides(): void {
    try {
      const storedOverrides = localStorage.getItem('production-config-overrides');
      if (storedOverrides) {
        this.configOverrides = JSON.parse(storedOverrides);
      }

      // Environment variable overrides
      if (process.env.REACT_APP_MAX_CONCURRENT_JOBS) {
        this.configOverrides.performance = {
          ...this.configOverrides.performance,
          maxConcurrentJobs: parseInt(process.env.REACT_APP_MAX_CONCURRENT_JOBS)
        };
      }

      if (process.env.REACT_APP_API_BASE_URL) {
        this.configOverrides.apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      }
    } catch (error) {
      console.warn('Failed to load configuration overrides:', error);
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

    try {
      localStorage.setItem('production-config-overrides', JSON.stringify(this.configOverrides));
    } catch (error) {
      console.warn('Failed to save configuration overrides:', error);
    }
  }

  /**
   * Reset configuration to environment defaults
   */
  resetConfig(): void {
    this.configOverrides = {};
    localStorage.removeItem('production-config-overrides');
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
      const memoryInfo = (performance as any).memory;
      const estimatedMemory = memoryInfo ?
        Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024) :
        1024; // Default to 1GB

      // Estimate CPU cores
      const cpuCores = navigator.hardwareConcurrency || 4;

      return {
        availableMemory: estimatedMemory,
        cpuCores
      };
    } catch (error) {
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