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
    maxFileSize: number;
    memoryLimit: number;
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
export declare class ProductionConfigManager {
    private currentEnv;
    private configOverrides;
    /**
     * Safely access process.env in environments where `process` may be undefined
     * (e.g. browser builds where Vite does not statically replace env vars).
     */
    private static getEnvVar;
    /**
     * Safely get NODE_ENV with browser-compatible fallback (ISS-012)
     */
    private static getNodeEnv;
    constructor();
    /**
     * Get environment-specific configuration
     */
    private getEnvironmentConfig;
    /**
     * Get quality presets for different environments
     */
    private getQualityPresets;
    /**
     * Validate that a parsed overrides object has correct field types.
     * Returns true if the shape is safe to use as Partial<ProductionEnvironment>.
     *
     * Public so that tests can directly assert rejection of malformed configs.
     */
    static validateConfigOverrides(parsed: Record<string, unknown>): boolean;
    /**
     * Load configuration overrides from localStorage or environment
     */
    private loadConfigOverrides;
    /**
     * Get the current configuration with overrides applied
     */
    getConfig(): ProductionEnvironment;
    /**
     * Push the effective `monitoring.logLevel` into the logger — the
     * boundary→generation bridge (REQ-059). Reads the MERGED config so a partial
     * override of an unrelated section still re-applies the correct level, and an
     * override of logLevel itself takes effect immediately. Private; the public
     * entry point is {@link applyRuntimeConfig}.
     */
    private applyLogLevel;
    /**
     * Apply runtime-consumed ProductionEnvironment fields to their decision-core
     * consumers. Currently the sole consumer is the logger (logLevel, REQ-059);
     * every other persisted field is dashboard-isolated or design-heavy to wire
     * (see REQ-060 audit). Public so the config owner (ProductionDashboard) can
     * trigger it at mount, and so {@link updateConfig}/{@link resetConfig}
     * re-apply on mutation for live propagation.
     */
    applyRuntimeConfig(): void;
    /**
     * Update configuration with overrides
     */
    updateConfig(overrides: Partial<ProductionEnvironment>): void;
    /**
     * Reset configuration to environment defaults
     */
    resetConfig(): void;
    /**
     * Validate current configuration
     */
    validateConfig(): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Get optimized configuration for current system capabilities
     */
    getOptimizedConfig(): ProductionEnvironment;
    /**
     * Get basic system information for optimization
     */
    private getSystemInfo;
    /**
     * Generate performance report
     */
    generatePerformanceReport(): {
        environment: string;
        systemInfo: ReturnType<typeof this.getSystemInfo>;
        configValidation: ReturnType<typeof this.validateConfig>;
        recommendations: string[];
    };
}
export declare const productionConfig: ProductionConfigManager;
export default productionConfig;
