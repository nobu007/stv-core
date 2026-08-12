/**
 * @jest-environment node
 */
/**
 * REQ-054 — closed-set anchor for the production-config persist→round-trip
 * finiteness family (declare→validate→persist→round-trip lifecycle).
 *
 * WHY THIS EXISTS
 * --------------
 * `ProductionConfigManager` persists user / environment overrides to
 * localStorage and reloads them on construction (`loadConfigOverrides` →
 * `validateConfigOverrides` → `getConfig`). localStorage survives a
 * `JSON.parse` round-trip, and a malicious or corrupted literal can overflow to
 * `Infinity` (e.g. `1e400`) or carry `NaN`. Those non-finite magnitudes are
 * nonsensical for every numeric config field (concurrency, file sizes, timeouts,
 * fps, canvas dims) and downstream cause infinite-frame loops / NaN propagation
 * / OOM — the exact failure the load-bearing comments at
 * production-config.ts (qualityPresets block) were written to prevent. The
 * chokepoint is `isPositiveFiniteNumber`, applied per-field inside
 * `validateConfigOverrides`.
 *
 * This is the SAME defect class as the construction-once-collaborator config
 * family (REQ-039..053): a field exposed on the boundary must be consumed at the
 * generation / restore site, or it is silently dead / unsafe. The sibling
 * anchor REQ-053 (`config-sync-forwarding-exhaustive.test.ts`) guards
 * `applyConfigToCollaborators` *forwarding*; this file guards the OTHER end of
 * the lifecycle — *restore-time finiteness validation*.
 *
 * The per-instance tests in `production-config.test.ts` prove known fields are
 * rejected, but they do NOT fail when a NEW numeric field is added to the
 * `ProductionEnvironment` interfaces without a matching `isPositiveFiniteNumber`
 * check: the field compiles, persists, round-trips an `Infinity`, and the bug
 * ships exactly the way the prior finiteness gaps (09y/09z) did. This file
 * closes that gap with a source-anchored set invariant:
 *
 *   the set of `number`-typed fields declared in the persisted
 *   ProductionEnvironment interfaces MUST equal the set of fields validated by
 *   `isPositiveFiniteNumber` inside `validateConfigOverrides`.
 *
 * If the two sets ever diverge this test goes RED, forcing a conscious decision
 * (add the validation check, or explicitly exempt the field here) instead of a
 * silent unvalidated persisted magnitude. Both sides are read straight from
 * source, so — unlike a hand-maintained checklist — the anchor itself cannot
 * drift: when a 14th numeric field is added to the type, the type edit and the
 * validation edit must land in the same commit or this pin fires.
 *
 * SURVEY NOTE (this iteration's declare→validate→persist→round-trip survey):
 * every persisted numeric in `ProductionEnvironment` IS validated today, so the
 * finiteness family is CLOSED. The same survey surfaced a boundary→generation
 * DEAD field: `monitoring.alertThresholds.{errorRate,responseTime,memoryUsage}`
 * is UI-editable (ProductionDashboard), validated, persisted and round-tripped,
 * yet the alerting engines never read it — `production-monitor.ts` uses its own
 * hardcoded `errorRateWarning/Critical` and `production-error-handler.ts` a
 * local `errorRate: 10` (errors/min). Wiring the persisted threshold in is
 * design-heavy (config 0.05/0.01 ratio vs monitor 0.05/0.15 — an alerting-policy
 * decision), so it is recorded here rather than silently behaviour-changed.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_FILE = path.resolve(__dirname, '../production-config.ts');

/**
 * The `number`-typed fields DECLARED across the persisted `ProductionEnvironment`
 * interfaces (PerformanceConfig / MonitoringConfig / alertThresholds /
 * ExportConfig / QualityPreset). Read straight from the interface source so the
 * anchor cannot drift from the type. Scoped to the region between the first
 * `export interface` and `export class ProductionConfigManager` to exclude
 * unrelated `: number` annotations (e.g. the `getSystemInfo` return shape or the
 * `performance.memory` cast later in the file).
 */
function readDeclaredNumericFields(): string[] {
  const src = fs.readFileSync(SOURCE_FILE, 'utf-8');
  const start = src.indexOf('export interface ProductionEnvironment');
  const end = src.indexOf('export class ProductionConfigManager');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('interface/class region not found in production-config.ts');
  }
  const region = src.slice(start, end);
  // `field: number;` / `field: number,` — trailing [;,] excludes the predicate
  // `(v: unknown): boolean` and inline return-type annotations.
  const names = [...region.matchAll(/(\w+)\s*:\s*number\s*[;,]/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

/**
 * The fields VALIDATED by `isPositiveFiniteNumber` inside
 * `validateConfigOverrides`. Each call has the shape
 * `isPositiveFiniteNumber(<holder>.<field>)`; we capture the field name so the
 * anchor is keyed on field identity, not the local holder variable. Scoped to
 * the function body (up to the next private method) so a coincidental
 * `isPositiveFiniteNumber` use elsewhere cannot widen the set unnoticed.
 */
function readValidatedFields(): string[] {
  const src = fs.readFileSync(SOURCE_FILE, 'utf-8');
  const fnStart = src.indexOf('static validateConfigOverrides');
  if (fnStart === -1) throw new Error('validateConfigOverrides not found');
  const fnEnd = src.indexOf('private loadConfigOverrides', fnStart);
  const body = fnEnd === -1 ? src.slice(fnStart) : src.slice(fnStart, fnEnd);
  const names = [...body.matchAll(/isPositiveFiniteNumber\(\w+\.(\w+)\)/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

describe('REQ-054: validateConfigOverrides covers every persisted numeric field (finiteness closed-set anchor)', () => {
  const declared = readDeclaredNumericFields();
  const validated = readValidatedFields();

  it('both extraction sets are non-empty (anchor is wired to real source)', () => {
    expect(declared.length).toBeGreaterThan(0);
    expect(validated.length).toBeGreaterThan(0);
  });

  it('every declared persisted numeric is validated (no unvalidated Infinity/NaN round-trip)', () => {
    const missing = declared.filter((f) => !validated.includes(f));
    expect(missing).toEqual([]);
  });

  it('every validation targets a declared persisted numeric (no orphan checks)', () => {
    const orphan = validated.filter((f) => !declared.includes(f));
    expect(orphan).toEqual([]);
  });

  it('declared == validated (full closed-set equality)', () => {
    expect(new Set(declared)).toEqual(new Set(validated));
  });
});
