export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["SILENT"] = 4] = "SILENT";
})(LogLevel || (LogLevel = {}));
// Mutable so the persisted production config (monitoring.logLevel) can drive the
// effective level at runtime — see ProductionConfigManager.applyRuntimeConfig
// (REQ-059). Was `const`; the field is the textbook boundary→generation dead
// field (declared + validated + persisted + round-tripped but previously never
// consumed by the decision core that emits logs). Default unchanged (INFO) so
// every existing consumer keeps its behaviour until a config owner applies one.
let currentLogLevel = LogLevel.INFO;
export const logger = {
    debug: (message, ...args) => {
        if (currentLogLevel <= LogLevel.DEBUG) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },
    info: (message, ...args) => {
        if (currentLogLevel <= LogLevel.INFO) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },
    warn: (message, ...args) => {
        if (currentLogLevel <= LogLevel.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    error: (message, ...args) => {
        if (currentLogLevel <= LogLevel.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
    /**
     * Set the effective log level at runtime. The single legitimate caller is
     * ProductionConfigManager, pushing the persisted `monitoring.logLevel` enum
     * (REQ-059) — the boundary→generation bridge that was missing. Exposed rather
     * than inferred from an env read so the config owner applies it explicitly
     * (no import-time side effect on this process-global singleton: applying in
     * the ProductionConfigManager constructor would non-deterministically mutate
     * the shared logger mid-test-batch, flipping unrelated level-sensitive tests).
     */
    setLevel(level) {
        currentLogLevel = level;
    },
    /** Current effective level — read-back for tests and diagnostics. */
    getLevel() {
        return currentLogLevel;
    },
};
