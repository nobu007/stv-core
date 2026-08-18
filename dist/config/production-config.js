import {
  bytesToMb
} from "../chunk-TYXEVUZT.js";
import {
  safeLoadFromStorage,
  safeRemoveFromStorage,
  safeSaveToStorage
} from "../chunk-GEWQD63K.js";
import "../chunk-N24QPVFO.js";
import {
  logger
} from "../chunk-NKCCCSWP.js";

// src/config/production-config.ts
var isPositiveFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
var isBooleanValue = (v) => typeof v === "boolean";
var PROD_CONFIG_ENUM_FIELDS = {
  name: ["development", "staging", "production"],
  cacheStrategy: ["memory", "redis", "hybrid"],
  optimizationLevel: ["basic", "standard", "aggressive"],
  logLevel: ["error", "warn", "info", "debug"],
  defaultFormat: ["mp4", "webm", "gif"]
};
var isAllowedEnumValue = (value, allowed) => typeof value === "string" && allowed.includes(value);
var LOG_LEVEL_BY_NAME = {
  error: 3 /* ERROR */,
  warn: 2 /* WARN */,
  info: 1 /* INFO */,
  debug: 0 /* DEBUG */
};
var ProductionConfigManager = class _ProductionConfigManager {
  constructor() {
    this.configOverrides = {};
    this.currentEnv = this.getEnvironmentConfig();
    this.loadConfigOverrides();
  }
  /**
   * Safely access process.env in environments where `process` may be undefined
   * (e.g. browser builds where Vite does not statically replace env vars).
   */
  static getEnvVar(key) {
    try {
      return typeof process !== "undefined" && process.env ? process.env[key] : void 0;
    } catch (err) {
      logger.warn(`[production-config] process.env access failed for key "${key}"`, err);
      return void 0;
    }
  }
  /**
   * Safely get NODE_ENV with browser-compatible fallback (ISS-012)
   */
  static getNodeEnv() {
    return _ProductionConfigManager.getEnvVar("NODE_ENV") || "development";
  }
  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig() {
    const env = _ProductionConfigManager.getNodeEnv();
    const configs = {
      development: {
        name: "development",
        apiBaseUrl: "http://localhost:3000/api",
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
          maxFileSize: 50 * 1024 * 1024,
          // 50MB
          memoryLimit: 512,
          timeoutMs: 6e4,
          cacheStrategy: "memory",
          enableCompression: false,
          optimizationLevel: "basic"
        },
        monitoring: {
          enableErrorTracking: true,
          enablePerformanceMonitoring: true,
          enableUserAnalytics: false,
          logLevel: "debug",
          metricsCollectionInterval: 5e3,
          alertThresholds: {
            errorRate: 0.1,
            responseTime: 5e3,
            memoryUsage: 0.8
          }
        },
        export: {
          defaultFormat: "mp4",
          qualityPresets: this.getQualityPresets("development"),
          concurrentExports: 1,
          compressionEnabled: false,
          watermarkEnabled: false
        }
      },
      staging: {
        name: "staging",
        apiBaseUrl: "https://staging-api.example.com/api",
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
          maxFileSize: 100 * 1024 * 1024,
          // 100MB
          memoryLimit: 1024,
          timeoutMs: 12e4,
          cacheStrategy: "hybrid",
          enableCompression: true,
          optimizationLevel: "standard"
        },
        monitoring: {
          enableErrorTracking: true,
          enablePerformanceMonitoring: true,
          enableUserAnalytics: true,
          logLevel: "info",
          metricsCollectionInterval: 1e4,
          alertThresholds: {
            errorRate: 0.05,
            responseTime: 3e3,
            memoryUsage: 0.75
          }
        },
        export: {
          defaultFormat: "mp4",
          qualityPresets: this.getQualityPresets("staging"),
          concurrentExports: 3,
          compressionEnabled: true,
          watermarkEnabled: true
        }
      },
      production: {
        name: "production",
        apiBaseUrl: "https://api.example.com/api",
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
          maxFileSize: 200 * 1024 * 1024,
          // 200MB
          memoryLimit: 2048,
          timeoutMs: 3e5,
          cacheStrategy: "redis",
          enableCompression: true,
          optimizationLevel: "aggressive"
        },
        monitoring: {
          enableErrorTracking: true,
          enablePerformanceMonitoring: true,
          enableUserAnalytics: true,
          logLevel: "warn",
          metricsCollectionInterval: 3e4,
          alertThresholds: {
            errorRate: 0.01,
            responseTime: 2e3,
            memoryUsage: 0.7
          }
        },
        export: {
          defaultFormat: "mp4",
          qualityPresets: this.getQualityPresets("production"),
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
  getQualityPresets(env) {
    const basePresets = [
      {
        name: "Mobile",
        width: 720,
        height: 480,
        fps: 24,
        bitrate: "1M",
        quality: 7,
        targetUse: "Mobile devices and low bandwidth"
      },
      {
        name: "Web HD",
        width: 1280,
        height: 720,
        fps: 30,
        bitrate: "3M",
        quality: 8,
        targetUse: "Web streaming and social media"
      },
      {
        name: "Full HD",
        width: 1920,
        height: 1080,
        fps: 30,
        bitrate: "6M",
        quality: 9,
        targetUse: "High-quality presentations"
      }
    ];
    if (env === "production") {
      basePresets.push(
        {
          name: "4K",
          width: 3840,
          height: 2160,
          fps: 30,
          bitrate: "20M",
          quality: 10,
          targetUse: "Ultra-high quality export"
        },
        {
          name: "GIF",
          width: 800,
          height: 600,
          fps: 12,
          bitrate: "500K",
          quality: 6,
          targetUse: "Animated GIF for demos"
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
  static validateConfigOverrides(parsed) {
    if ("apiBaseUrl" in parsed && typeof parsed.apiBaseUrl !== "string") return false;
    if ("name" in parsed && !isAllowedEnumValue(parsed.name, PROD_CONFIG_ENUM_FIELDS.name)) return false;
    if ("features" in parsed) {
      const f = parsed.features;
      if (f === null || typeof f !== "object" || Array.isArray(f)) return false;
      const feat = f;
      if ("realTimeProcessing" in feat && !isBooleanValue(feat.realTimeProcessing)) return false;
      if ("advancedAnalytics" in feat && !isBooleanValue(feat.advancedAnalytics)) return false;
      if ("multiLanguageSupport" in feat && !isBooleanValue(feat.multiLanguageSupport)) return false;
      if ("batchProcessing" in feat && !isBooleanValue(feat.batchProcessing)) return false;
      if ("collaborativeEditing" in feat && !isBooleanValue(feat.collaborativeEditing)) return false;
      if ("enterpriseFeatures" in feat && !isBooleanValue(feat.enterpriseFeatures)) return false;
      if ("experimentalFeatures" in feat && !isBooleanValue(feat.experimentalFeatures)) return false;
    }
    if ("performance" in parsed) {
      const p = parsed.performance;
      if (p === null || typeof p !== "object" || Array.isArray(p)) return false;
      const perf = p;
      if ("maxConcurrentJobs" in perf && !isPositiveFiniteNumber(perf.maxConcurrentJobs)) return false;
      if ("timeoutMs" in perf && !isPositiveFiniteNumber(perf.timeoutMs)) return false;
      if ("maxFileSize" in perf && !isPositiveFiniteNumber(perf.maxFileSize)) return false;
      if ("memoryLimit" in perf && !isPositiveFiniteNumber(perf.memoryLimit)) return false;
      if ("cacheStrategy" in perf && !isAllowedEnumValue(perf.cacheStrategy, PROD_CONFIG_ENUM_FIELDS.cacheStrategy)) return false;
      if ("optimizationLevel" in perf && !isAllowedEnumValue(perf.optimizationLevel, PROD_CONFIG_ENUM_FIELDS.optimizationLevel)) return false;
      if ("enableCompression" in perf && !isBooleanValue(perf.enableCompression)) return false;
    }
    if ("monitoring" in parsed) {
      const m = parsed.monitoring;
      if (m === null || typeof m !== "object" || Array.isArray(m)) return false;
      const mon = m;
      if ("enableErrorTracking" in mon && !isBooleanValue(mon.enableErrorTracking)) return false;
      if ("enablePerformanceMonitoring" in mon && !isBooleanValue(mon.enablePerformanceMonitoring)) return false;
      if ("enableUserAnalytics" in mon && !isBooleanValue(mon.enableUserAnalytics)) return false;
      if ("metricsCollectionInterval" in mon && !isPositiveFiniteNumber(mon.metricsCollectionInterval)) return false;
      if ("logLevel" in mon && !isAllowedEnumValue(mon.logLevel, PROD_CONFIG_ENUM_FIELDS.logLevel)) return false;
      if ("alertThresholds" in mon) {
        const at = mon.alertThresholds;
        if (at === null || typeof at !== "object" || Array.isArray(at)) return false;
        const thresholds = at;
        if ("errorRate" in thresholds && !isPositiveFiniteNumber(thresholds.errorRate)) return false;
        if ("responseTime" in thresholds && !isPositiveFiniteNumber(thresholds.responseTime)) return false;
        if ("memoryUsage" in thresholds && !isPositiveFiniteNumber(thresholds.memoryUsage)) return false;
      }
    }
    if ("export" in parsed) {
      const e = parsed.export;
      if (e === null || typeof e !== "object" || Array.isArray(e)) return false;
      const exp = e;
      if ("concurrentExports" in exp && !isPositiveFiniteNumber(exp.concurrentExports)) return false;
      if ("defaultFormat" in exp && !isAllowedEnumValue(exp.defaultFormat, PROD_CONFIG_ENUM_FIELDS.defaultFormat)) return false;
      if ("compressionEnabled" in exp && !isBooleanValue(exp.compressionEnabled)) return false;
      if ("watermarkEnabled" in exp && !isBooleanValue(exp.watermarkEnabled)) return false;
      if ("qualityPresets" in exp) {
        const qp = exp.qualityPresets;
        if (!Array.isArray(qp)) return false;
        for (const preset of qp) {
          if (preset === null || typeof preset !== "object" || Array.isArray(preset)) return false;
          const p = preset;
          if ("width" in p && !isPositiveFiniteNumber(p.width)) return false;
          if ("height" in p && !isPositiveFiniteNumber(p.height)) return false;
          if ("fps" in p && !isPositiveFiniteNumber(p.fps)) return false;
          if ("quality" in p && !isPositiveFiniteNumber(p.quality)) return false;
        }
      }
    }
    return true;
  }
  /**
   * Load configuration overrides from localStorage or environment
   */
  loadConfigOverrides() {
    const parsed = safeLoadFromStorage(
      "production-config-overrides",
      (v) => v !== null && typeof v === "object" && !Array.isArray(v) && _ProductionConfigManager.validateConfigOverrides(v),
      "ProductionConfig",
      {}
    );
    if (Object.keys(parsed).length > 0) {
      this.configOverrides = parsed;
    }
    try {
      const maxConcurrent = _ProductionConfigManager.getEnvVar("REACT_APP_MAX_CONCURRENT_JOBS");
      if (maxConcurrent) {
        const parsed2 = parseInt(maxConcurrent, 10);
        if (isPositiveFiniteNumber(parsed2)) {
          this.configOverrides.performance = {
            ...this.configOverrides.performance,
            maxConcurrentJobs: parsed2
          };
        }
      }
      const apiBaseUrl = _ProductionConfigManager.getEnvVar("REACT_APP_API_BASE_URL");
      if (apiBaseUrl) {
        this.configOverrides.apiBaseUrl = apiBaseUrl;
      }
    } catch (error) {
      logger.warn("Failed to load configuration overrides:", error);
    }
  }
  /**
   * Get the current configuration with overrides applied
   */
  getConfig() {
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
   * Push the effective `monitoring.logLevel` into the logger — the
   * boundary→generation bridge (REQ-059). Reads the MERGED config so a partial
   * override of an unrelated section still re-applies the correct level, and an
   * override of logLevel itself takes effect immediately. Private; the public
   * entry point is {@link applyRuntimeConfig}.
   */
  applyLogLevel() {
    logger.setLevel(LOG_LEVEL_BY_NAME[this.getConfig().monitoring.logLevel]);
  }
  /**
   * Apply runtime-consumed ProductionEnvironment fields to their decision-core
   * consumers. Currently the sole consumer is the logger (logLevel, REQ-059);
   * every other persisted field is dashboard-isolated or design-heavy to wire
   * (see REQ-060 audit). Public so the config owner (ProductionDashboard) can
   * trigger it at mount, and so {@link updateConfig}/{@link resetConfig}
   * re-apply on mutation for live propagation.
   */
  applyRuntimeConfig() {
    this.applyLogLevel();
  }
  /**
   * Update configuration with overrides
   */
  updateConfig(overrides) {
    this.configOverrides = {
      ...this.configOverrides,
      ...overrides
    };
    safeSaveToStorage("production-config-overrides", this.configOverrides, "ProductionConfigManager");
    this.applyLogLevel();
  }
  /**
   * Reset configuration to environment defaults
   */
  resetConfig() {
    this.configOverrides = {};
    safeRemoveFromStorage("production-config-overrides", "ProductionConfigManager.resetConfig");
    this.applyLogLevel();
  }
  /**
   * Validate current configuration
   */
  validateConfig() {
    const config = this.getConfig();
    const errors = [];
    if (config.performance.maxConcurrentJobs < 1) {
      errors.push("Max concurrent jobs must be at least 1");
    }
    if (config.performance.maxFileSize < 1024 * 1024) {
      errors.push("Max file size must be at least 1MB");
    }
    if (config.performance.timeoutMs < 1e4) {
      errors.push("Timeout must be at least 10 seconds");
    }
    if (config.monitoring.metricsCollectionInterval < 1e3) {
      errors.push("Metrics collection interval must be at least 1 second");
    }
    if (config.export.concurrentExports < 1) {
      errors.push("Concurrent exports must be at least 1");
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  /**
   * Get optimized configuration for current system capabilities
   */
  getOptimizedConfig() {
    const config = this.getConfig();
    const systemInfo = this.getSystemInfo();
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
  getSystemInfo() {
    try {
      const memoryInfo = performance.memory;
      const estimatedMemory = memoryInfo ? Math.round(bytesToMb(memoryInfo.jsHeapSizeLimit)) : 1024;
      const cpuCores = navigator.hardwareConcurrency || 4;
      return {
        availableMemory: estimatedMemory,
        cpuCores
      };
    } catch (error) {
      logger.warn("[ProductionConfig] Failed to gather system info, using defaults:", error);
      return {
        availableMemory: 1024,
        cpuCores: 4
      };
    }
  }
  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    const config = this.getConfig();
    const systemInfo = this.getSystemInfo();
    const validation = this.validateConfig();
    const recommendations = [];
    if (systemInfo.availableMemory < config.performance.memoryLimit) {
      recommendations.push(`Reduce memory limit from ${config.performance.memoryLimit}MB to ${Math.round(systemInfo.availableMemory * 0.7)}MB`);
    }
    if (config.performance.maxConcurrentJobs > systemInfo.cpuCores) {
      recommendations.push(`Reduce concurrent jobs from ${config.performance.maxConcurrentJobs} to ${systemInfo.cpuCores} (matches CPU cores)`);
    }
    if (config.name === "production" && config.monitoring.logLevel === "debug") {
      recommendations.push("Change log level from debug to warn for production");
    }
    return {
      environment: config.name,
      systemInfo,
      configValidation: validation,
      recommendations
    };
  }
};
var productionConfig = new ProductionConfigManager();
var production_config_default = productionConfig;
export {
  ProductionConfigManager,
  production_config_default as default,
  productionConfig
};
