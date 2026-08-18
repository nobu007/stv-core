import {
  logger
} from "./chunk-NKCCCSWP.js";

// src/utils/report-corruption.ts
var activeHandler = null;
function setCorruptionHandler(handler) {
  activeHandler = handler;
}
function reportCorruption(source, detail, recovered = true) {
  const report = {
    source,
    detail,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    recovered
  };
  logger.warn(`[Corruption:${source}] ${detail} (recovered=${recovered})`);
  if (activeHandler) {
    try {
      activeHandler(report);
    } catch (handlerError) {
      logger.error("[report-corruption] Corruption handler threw:", handlerError);
    }
  }
  return report;
}

export {
  setCorruptionHandler,
  reportCorruption
};
