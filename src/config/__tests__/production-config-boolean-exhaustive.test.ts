/**
 * @jest-environment node
 */
/**
 * REQ-057 — closed-set anchor for the production-config persist→round-trip
 * boolean-validation family (declare→validate→persist→round-trip lifecycle).
 *
 * WHY THIS EXISTS
 * --------------
 * `ProductionConfigManager` persists user / environment overrides to
 * localStorage and reloads them on construction (`loadConfigOverrides` →
 * `validateConfigOverrides` → `getConfig`). localStorage survives a
 * `JSON.parse` round-trip, so a tampered or corrupted payload can carry any
 * JSON value. Until this anchor, `validateConfigOverrides` shape-checked each
 * nested section object (`features`, `performance`, `monitoring`, `export`) but
 * did NOT constrain a member's type — a non-boolean such as
 * `features: { realTimeProcessing: "yes" }` or
 * `performance: { enableCompression: 1 }` passed the shape gate exactly the way
 * `Infinity` passes `typeof === 'number'`, then crossed the restore boundary.
 *
 * ProductionDashboard runs a read-modify-write cycle over these fields
 * (`getConfig()` → render in `<Switch checked={value}>` → `handleConfigUpdate`
 * → `updateConfig` → `safeSaveToStorage`): a non-boolean renders as an
 * inconsistent controlled-input state AND is re-persisted on the next save,
 * propagating the corruption. The boundary type-check is the firewall. The
 * chokepoint is `isBooleanValue`, applied per-field inside
 * `validateConfigOverrides`.
 *
 * This is the BOOLEAN twin of REQ-054 (`production-config-finiteness-exhaustive`,
 * numeric tail, `isPositiveFiniteNumber`) and REQ-055
 * (`production-config-enum-exhaustive`, literal-union tail,
 * `isAllowedEnumValue`). Together the three anchors prove the FULL
 * declare→validate→persist→round-trip family is closed: every persisted scalar
 * crossing the restore boundary is type-checked — finiteness (number), set
 * membership (literal union), or boolean.
 *
 * The per-instance tests in `production-config.test.ts` prove known fields are
 * rejected, but they do NOT fail when a NEW boolean field is added to the
 * `ProductionEnvironment` interfaces without a matching `isBooleanValue` check:
 * the field compiles, persists, round-trips a non-boolean, and the bug ships.
 * This file closes that gap with a source-anchored set invariant:
 *
 *   the set of `boolean`-typed fields DECLARED in the persisted
 *   ProductionEnvironment interfaces MUST equal the set of fields validated by
 *   `isBooleanValue` inside `validateConfigOverrides`.
 *
 * If the two sets ever diverge this test goes RED, forcing a conscious decision
 * (add the validation check, or explicitly exempt the field here) instead of a
 * silent unvalidated persisted boolean. Both sides are read straight from
 * source, so — unlike a hand-maintained checklist — the anchor itself cannot
 * drift: when a 14th boolean field is added to the type, the type edit and the
 * validation edit must land in the same commit or this pin fires.
 *
 * RED VERIFICATION
 * ----------------
 * Reverting any single boolean check (e.g. deleting the `enableCompression`
 * line in `validateConfigOverrides`) shrinks the validated set → set-equality
 * fails. The per-instance `it.each` rows below also flip from `false` back to
 * `true`, proving the rejection is owed to THIS fix, not some other guard.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { ProductionConfigManager } from '../production-config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_FILE = path.resolve(__dirname, '../production-config.ts');

/**
 * The `boolean`-typed fields DECLARED across the persisted `ProductionEnvironment`
 * interfaces (FeatureFlags / PerformanceConfig / MonitoringConfig / ExportConfig).
 * Read straight from the interface source so the anchor cannot drift from the
 * type. Scoped to the region between the first `export interface` and
 * `export class ProductionConfigManager`. The trailing `[;,]` requirement
 * excludes the `isBooleanValue` predicate's own `(v: unknown): boolean =>`
 * return annotation (which is followed by ` =>`, not `;`/`,`) and any prose in
 * comments. Boolean field names are unique across the four sections, so flat
 * field-name matching (no section qualification) is unambiguous.
 */
function readDeclaredBooleanFields(): string[] {
  const src = fs.readFileSync(SOURCE_FILE, 'utf-8');
  const start = src.indexOf('export interface ProductionEnvironment');
  const end = src.indexOf('export class ProductionConfigManager');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('interface/class region not found in production-config.ts');
  }
  const region = src.slice(start, end);
  const names = [...region.matchAll(/(\w+)\s*:\s*boolean\s*[;,]/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

/**
 * The fields VALIDATED by `isBooleanValue` inside `validateConfigOverrides`.
 * Each call has the shape `isBooleanValue(<holder>.<field>)`; we capture the
 * field name so the anchor is keyed on field identity, not the local holder
 * variable (`feat` / `perf` / `mon` / `exp`). Scoped to the function body (up
 * to the next private method) so a coincidental `isBooleanValue` use elsewhere
 * cannot widen the set unnoticed.
 */
function readValidatedBooleanFields(): string[] {
  const src = fs.readFileSync(SOURCE_FILE, 'utf-8');
  const fnStart = src.indexOf('static validateConfigOverrides');
  if (fnStart === -1) throw new Error('validateConfigOverrides not found');
  const fnEnd = src.indexOf('private loadConfigOverrides', fnStart);
  const body = fnEnd === -1 ? src.slice(fnStart) : src.slice(fnStart, fnEnd);
  const names = [...body.matchAll(/isBooleanValue\(\w+\.(\w+)\)/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

describe('REQ-057: validateConfigOverrides covers every persisted boolean field (boolean closed-set anchor)', () => {
  const declared = readDeclaredBooleanFields();
  const validated = readValidatedBooleanFields();

  it('both extraction sets are non-empty (anchor is wired to real source)', () => {
    expect(declared.length).toBeGreaterThan(0);
    expect(validated.length).toBeGreaterThan(0);
  });

  it('every declared persisted boolean is validated (no unvalidated non-boolean round-trip)', () => {
    const missing = declared.filter((f) => !validated.includes(f));
    expect(missing).toEqual([]);
  });

  it('every validation targets a declared persisted boolean (no orphan checks)', () => {
    const orphan = validated.filter((f) => !declared.includes(f));
    expect(orphan).toEqual([]);
  });

  it('declared == validated (full closed-set equality)', () => {
    expect(new Set(declared)).toEqual(new Set(validated));
  });
});

describe('REQ-057: non-boolean values are rejected at the restore boundary (defect instance)', () => {
  // Before REQ-057 these all returned `true` — the non-boolean survived the
  // shape-only section check and round-tripped into getConfig(). Each row is the
  // defect instance the closed-set anchor above structurally machine-enforces.
  // One representative field per section (features / performance / monitoring /
  // export), plus the falsy-but-wrong `0`/`""` cases that a bare truthiness
  // guard would wrongly accept.
  it.each([
    ['features.realTimeProcessing', { features: { realTimeProcessing: 'yes' } }],
    ['features.advancedAnalytics', { features: { advancedAnalytics: 1 } }],
    ['performance.enableCompression', { performance: { enableCompression: 1 } }],
    ['monitoring.enableErrorTracking', { monitoring: { enableErrorTracking: 'true' } }],
    ['monitoring.enableUserAnalytics', { monitoring: { enableUserAnalytics: 0 } }],
    ['export.compressionEnabled', { export: { compressionEnabled: 'no' } }],
    ['export.watermarkEnabled', { export: { watermarkEnabled: '' } }],
  ] as const)('rejects non-boolean %s', (_label, override) => {
    expect(ProductionConfigManager.validateConfigOverrides(override)).toBe(false);
  });

  it.each([
    ['features.realTimeProcessing', { features: { realTimeProcessing: true } }],
    ['performance.enableCompression', { performance: { enableCompression: false } }],
    ['monitoring.enablePerformanceMonitoring', { monitoring: { enablePerformanceMonitoring: true } }],
    ['export.watermarkEnabled', { export: { watermarkEnabled: false } }],
  ] as const)('accepts boolean %s', (_label, override) => {
    expect(ProductionConfigManager.validateConfigOverrides(override)).toBe(true);
  });

  it('omitting a boolean field is still accepted (Partial — absent ≠ malformed)', () => {
    expect(ProductionConfigManager.validateConfigOverrides({})).toBe(true);
  });

  it('a valid full config round-trips through the validator', () => {
    expect(
      ProductionConfigManager.validateConfigOverrides({
        name: 'staging',
        features: { realTimeProcessing: true, batchProcessing: false },
        performance: { cacheStrategy: 'hybrid', enableCompression: true },
        monitoring: { logLevel: 'info', enableErrorTracking: false },
        export: { defaultFormat: 'mp4', compressionEnabled: true, watermarkEnabled: false },
      }),
    ).toBe(true);
  });
});
