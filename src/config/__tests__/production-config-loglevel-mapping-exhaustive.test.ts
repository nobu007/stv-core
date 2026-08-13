/**
 * @jest-environment node
 */
/**
 * REQ-060 — source-anchored closed-set anchor for the `monitoring.logLevel`
 * boundary→generation bridge (the REQ-059 wiring), plus the captured bulk
 * audit of every other persisted ProductionEnvironment field.
 *
 * WHY THIS EXISTS
 * --------------
 * REQ-059 wired `monitoring.logLevel` to the logger via a `LOG_LEVEL_BY_NAME`
 * map typed `Record<ProductionEnvironment['monitoring']['logLevel'], LogLevel>`.
 * That `Record<union,…>` makes an unmapped literal a COMPILE error — but only
 * while the key type stays the exact union. The recurring lesson (REQ-058) is
 * that a hand-maintained structure drifts from its interface twin: relaxing the
 * map to `Record<string,…>` or `Partial<…>` would silently re-open the dead
 * field (a type-legal `logLevel` literal with no numeric mapping → undefined →
 * logger.setLevel(undefined) → the level silently does not change). This file
 * is the value-level drift twin: it reads the interface union literals and the
 * map keys straight from source and asserts they are the SAME set, so the map
 * cannot drift from the type at either the key or the literal level.
 *
 * It additionally asserts every mapped value is a real `LogLevel` enum member
 * (read from logger.ts), so a typo'd `LogLevel.WORRN` is caught even though it
 * would compile against a widened enum. And it pins the WIRING SITES — that
 * `updateConfig` and `resetConfig` each call `applyLogLevel()` — so the live-
 * propagation contract (REQ-059 behavioural pin) cannot be silently un-wired.
 *
 * SOURCE-ANCHORED BULK AUDIT (the "all persisted-config" deliverable)
 * -----------------------------------------------------------------
 * ProductionEnvironment is the ONLY structured config persisted in this repo
 * (localStorage key `production-config-overrides`; TutorialSystem persists UI
 * state, not config). The audit below is the field-by-field verdict on whether
 * each persisted field reaches a generation/decision core. It was produced by
 * grepping every consumer of each field across src/ (the make-run "一括監査"
 * ask). `monitoring.logLevel` is the SOLE field with a clean, mismatch-free
 * consumer; wiring it (REQ-059) closed the one actionable member of this
 * repo's most prolific defect class (boundary→generation dead field). Every
 * other field is dashboard-isolated or design-heavy to wire, documented here
 * so the next iteration does not re-hunt them:
 *
 *   name (env) .................. DASHBOARD-ONLY (getConfig badge/report). No
 *                                 generation consumer; gating behaviour by env
 *                                 is a product decision.
 *   apiBaseUrl .................. DASHBOARD-ONLY. No api client reads it (src/api
 *                                 has no base-URL consumer to switch); supabase
 *                                 uses its own env vars. Wiring = new feature.
 *   features.* (7 booleans) ..... DASHBOARD-ONLY. No pipeline/UI gates on them;
 *                                 each flag's semantics is a product decision.
 *   performance.maxConcurrentJobs  DASHBOARD-ONLY (display). Job queue / batch
 *                                 sizing do not read it (hardcoded elsewhere).
 *   performance.maxFileSize ..... DASHBOARD-ONLY (display).
 *   performance.memoryLimit ..... DASHBOARD-ONLY (report recommendation text).
 *   performance.timeoutMs ....... PARAM-THREADED, not config-driven. Every
 *                                 consumer (api middleware/routes, gemini-
 *                                 analyzer, parallel-layout-executor default
 *                                 30000) takes timeoutMs as a function arg;
 *                                 none reads production-config. Threading the
 *                                 config through all call sites = large blast
 *                                 radius, design decision.
 *   performance.cacheStrategy ... DASHBOARD-ONLY. intelligent-cache has no
 *                                 strategy enum to switch on.
 *   performance.optimizationLevel DASHBOARD-ONLY. advanced-layouts has an
 *                                 `optimizationLevel: number` (different unit
 *                                 — number vs 'basic'|'standard'|'aggressive');
 *                                 mismatch, not a clean wire.
 *   performance.enableCompression DASHBOARD-ONLY. intelligent-cache hardcodes
 *                                 `compressionEnabled = true` (a third
 *                                 compression concept vs export.compressionEnabled).
 *   monitoring.enable*Tracking (3) DASHBOARD-ONLY. No analytics engine reads them.
 *   monitoring.metricsCollectionInterval DASHBOARD-ONLY. No collector reads it.
 *   monitoring.logLevel ......... WIRED (REQ-059) → logger.setLevel. The one
 *                                 clean 1:1 literal↔enum consumer.
 *   monitoring.alertThresholds.* (3) DESIGN-HEAVY. production-monitor.ts
 *                                 hardcodes `errorRateWarning:0.05`/
 *                                 `errorRateCritical:0.15`/`averageLatency`/
 *                                 `successRate`; config has a SINGLE
 *                                 `errorRate` ratio + `responseTime` +
 *                                 `memoryUsage` — names AND arity mismatch
 *                                 (one threshold vs warning+critical; no memory
 *                                 threshold in the monitor). Wiring requires a
 *                                 product alerting-policy decision, not a map.
 *   export.defaultFormat ........ DASHBOARD-ONLY. Export engines take format
 *                                 per-job, not from production-config.
 *   export.qualityPresets[] ..... DASHBOARD-ONLY (display + round-trip). Canvas
 *                                 dims/fps come from per-job export config.
 *   export.concurrentExports .... DASHBOARD-ONLY (display). getOptimizedConfig
 *                                 caps it but no exporter reads it.
 *   export.compressionEnabled ... DASHBOARD-ONLY. Third compression concept (see
 *                                 performance.enableCompression); per-job only.
 *   export.watermarkEnabled ..... PER-JOB, not config-driven. enhanced-export-
 *                                 engine/export-ui drive watermark from
 *                                 per-job `config.settings.watermark` (default
 *                                 false); production-config has no default path.
 *
 * Net: logLevel wired + locked; the remaining ~25 fields are dashboard-isolated
 * or design-heavy. This anchor's structural assertions below guarantee the one
 * wired field cannot drift, and the audit above is the closed-set record so the
 * class is not re-hunted.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_FILE = path.resolve(__dirname, '../production-config.ts');
const LOGGER_FILE = path.resolve(__dirname, '../../utils/logger.ts');

function readSource(): string {
  return fs.readFileSync(SOURCE_FILE, 'utf-8');
}

/**
 * The `logLevel` literals DECLARED in the MonitoringConfig interface union, read
 * straight from source. Scoped to the interface→roster region (same scope as
 * REQ-058) so the LOG_LEVEL_BY_NAME map's own literals cannot be matched here.
 */
function readDeclaredLogLevelLiterals(): string[] {
  const src = readSource();
  const start = src.indexOf('export interface ProductionEnvironment');
  const end = src.indexOf('const PROD_CONFIG_ENUM_FIELDS');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('interface/const region not found in production-config.ts');
  }
  const region = src.slice(start, end);
  const m = region.match(/logLevel\s*:\s*('[^']+'(?:\s*\|\s*'[^']+')+)\s*[;,]/);
  if (!m) throw new Error('logLevel union declaration not found in interface');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

/**
 * The KEYS of `LOG_LEVEL_BY_NAME` — the set of logLevel names the bridge maps.
 * Scoped to the map block (const declaration → following `export class`).
 */
function readLogLevelMapKeys(): string[] {
  const src = readSource();
  const start = src.indexOf('const LOG_LEVEL_BY_NAME');
  const end = src.indexOf('export class ProductionConfigManager');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LOG_LEVEL_BY_NAME const block not found');
  }
  const block = src.slice(start, end);
  return [...block.matchAll(/(\w+)\s*:\s*LogLevel\./g)].map((m) => m[1]).sort();
}

/**
 * The VALUES the bridge maps each name to (e.g. `LogLevel.ERROR`), as the
 * enum-member-name strings — so we can assert each is a real declared member.
 */
function readLogLevelMapValues(): string[] {
  const src = readSource();
  const start = src.indexOf('const LOG_LEVEL_BY_NAME');
  const end = src.indexOf('export class ProductionConfigManager');
  const block = src.slice(start, end);
  return [...block.matchAll(/:\s*LogLevel\.(\w+)/g)].map((m) => m[1]);
}

/**
 * The `LogLevel` enum member NAMES declared in logger.ts — the universe of
 * legal map targets. Read straight from the enum source.
 */
function readLogLevelEnumMembers(): string[] {
  const src = fs.readFileSync(LOGGER_FILE, 'utf-8');
  const m = src.match(/export\s+enum\s+LogLevel\s*\{([\s\S]*?)\}/);
  if (!m) throw new Error('LogLevel enum not found in logger.ts');
  return [...m[1].matchAll(/(\w+)\s*=/g)].map((x) => x[1]);
}

describe('REQ-060: LOG_LEVEL_BY_NAME is exhaustive & enum-valid (drift-proof bridge)', () => {
  const declared = readDeclaredLogLevelLiterals();
  const mapKeys = readLogLevelMapKeys();
  const mapValues = readLogLevelMapValues();
  const enumMembers = readLogLevelEnumMembers();

  it('extraction is wired to real source (non-empty sets)', () => {
    expect(declared.length).toBeGreaterThan(0);
    expect(mapKeys.length).toBeGreaterThan(0);
    expect(enumMembers.length).toBeGreaterThan(0);
  });

  it('map keys == interface logLevel literals (no unmapped / no orphan literal)', () => {
    // A literal added to the union without a map entry (dead field reopens) OR
    // a map entry without the literal (orphan) both fail this.
    expect(new Set(mapKeys)).toEqual(new Set(declared));
  });

  it('every map value is a real declared LogLevel enum member', () => {
    const invalid = mapValues.filter((v) => !enumMembers.includes(v));
    expect(invalid).toEqual([]);
  });

  it('map maps each literal to a DISTINCT level (no two names collapse)', () => {
    // 4 logLevel names → 4 distinct numeric levels; a collision would silently
    // make two persisted levels behave identically.
    expect(new Set(mapValues).size).toBe(mapValues.length);
  });
});

describe('REQ-060: live-propagation wiring sites are present (structural)', () => {
  // The REQ-059 behavioural pin proves updateConfig/resetConfig push logLevel to
  // the logger. This structural twin names the SITE, so removing the
  // applyLogLevel() call from either mutation path is caught even if the
  // behavioural test happened not to exercise that exact path.
  const src = readSource();

  it('applyRuntimeConfig is the public bridge entry point', () => {
    expect(src).toMatch(/applyRuntimeConfig\s*\(/);
  });

  it('updateConfig calls applyLogLevel (live propagation on save)', () => {
    const fnStart = src.indexOf('updateConfig(');
    const fnEnd = src.indexOf('resetConfig(', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const body = src.slice(fnStart, fnEnd);
    expect(body).toMatch(/this\.applyLogLevel\s*\(\s*\)/);
  });

  it('resetConfig calls applyLogLevel (live propagation on reset)', () => {
    const fnStart = src.indexOf('resetConfig(');
    const fnEnd = src.indexOf('validateConfig(', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const body = src.slice(fnStart, fnEnd);
    expect(body).toMatch(/this\.applyLogLevel\s*\(\s*\)/);
  });
});
