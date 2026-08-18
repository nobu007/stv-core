// src/utils/logger.ts
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  LogLevel2[LogLevel2["SILENT"] = 4] = "SILENT";
  return LogLevel2;
})(LogLevel || {});
var currentLogLevel = 1 /* INFO */;
var logger = {
  debug: (message, ...args) => {
    if (currentLogLevel <= 0 /* DEBUG */) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    if (currentLogLevel <= 1 /* INFO */) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (currentLogLevel <= 2 /* WARN */) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    if (currentLogLevel <= 3 /* ERROR */) {
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
  }
};

export {
  LogLevel,
  logger
};
