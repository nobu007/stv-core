export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4
}
export declare const logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    /**
     * Set the effective log level at runtime. The single legitimate caller is
     * ProductionConfigManager, pushing the persisted `monitoring.logLevel` enum
     * (REQ-059) — the boundary→generation bridge that was missing. Exposed rather
     * than inferred from an env read so the config owner applies it explicitly
     * (no import-time side effect on this process-global singleton: applying in
     * the ProductionConfigManager constructor would non-deterministically mutate
     * the shared logger mid-test-batch, flipping unrelated level-sensitive tests).
     */
    setLevel(level: LogLevel): void;
    /** Current effective level — read-back for tests and diagnostics. */
    getLevel(): LogLevel;
};
