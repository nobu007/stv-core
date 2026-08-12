/**
 * @jest-environment node
 */
/**
 * REQ-055 — closed-set anchor for the production-config persist→round-trip
 * enum-validation family (declare→validate→persist→round-trip lifecycle).
 *
 * WHY THIS EXISTS
 * --------------
 * `ProductionConfigManager` persists user / environment overrides to
 * localStorage and reloads them on construction (`loadConfigOverrides` →
 * `validateConfigOverrides` → `getConfig`). localStorage survives a
 * `JSON.parse` round-trip, so a tampered or corrupted payload can carry any
 * string. `typeof === 'string'` is insufficient for a field whose type is a
 * string-literal union — an out-of-set value like `logLevel: "trace"`,
 * `defaultFormat: "exe"`, or `name: "attacker"` passes the type-guard exactly
 * the way `Infinity` passes `typeof === 'number'`, then crosses the restore
 * boundary into downstream consumers (logger setup, export-format selection,
 * ProductionDashboard) that assume the enum invariant. The chokepoint is
 * `PROD_CONFIG_ENUM_FIELDS` + `isAllowedEnumValue`, applied per-field inside
 * `validateConfigOverrides`.
 *
 * This is the enum twin of REQ-054 (`production-config-finiteness-exhaustive`),
 * which anchored the NUMERIC tail of the same lifecycle with
 * `isPositiveFiniteNumber`. Together the two anchors prove the full
 * declare→validate→persist→round-trip family is closed: every persisted scalar
 * is either finiteness-checked (number) or enum-checked (literal union).
 *
 * The per-instance tests in `production-config.test.ts` prove known fields are
 * rejected, but they do NOT fail when a NEW literal-union field is added to the
 * `ProductionEnvironment` interfaces without a matching enum check: the field
 * compiles, persists, round-trips an out-of-set string, and the bug ships. This
 * file closes that gap with a source-anchored three-way set invariant:
 *
 *   the set of string-literal-union fields DECLARED in the persisted
 *   ProductionEnvironment interfaces MUST equal the keys of
 *   PROD_CONFIG_ENUM_FIELDS AND equal the fields referenced by an enum check
 *   inside validateConfigOverrides.
 *
 * All three sets are read straight from source, so — unlike a hand-maintained
 * checklist — the anchor cannot drift: when a 6th enum field is added to the
 * type, the type edit, the roster edit, and the validation edit must all land in
 * the same commit or this pin fires.
 *
 * RED VERIFICATION
 * ----------------
 * Reverting any single enum check (e.g. deleting the `logLevel` line in
 * `validateConfigOverrides`) shrinks the validated set → set-equality fails.
 * The per-instance `it.each` rows below also flip from `false` back to `true`,
 * proving the rejection is owed to THIS fix, not to some other guard.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { ProductionConfigManager } from '../production-config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_FILE = path.resolve(__dirname, '../production-config.ts');

function readSource(): string {
  return fs.readFileSync(SOURCE_FILE, 'utf-8');
}

/**
 * String-literal-union (enum) fields DECLARED across the persisted
 * `ProductionEnvironment` interfaces — `field: 'a' | 'b' | 'c'`. Read straight
 * from the interface source so the anchor cannot drift from the type. Scoped to
 * the region between the first `export interface` and the `PROD_CONFIG_ENUM_FIELDS`
 * const so the const's own array literals (comma form, not `|` unions) cannot be
 * matched, and unrelated `: string` annotations are excluded by the `|` requirement.
 */
function readDeclaredEnumFields(): string[] {
  const src = readSource();
  const start = src.indexOf('export interface ProductionEnvironment');
  const end = src.indexOf('const PROD_CONFIG_ENUM_FIELDS');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('interface/const region not found in production-config.ts');
  }
  const region = src.slice(start, end);
  const names = [...region.matchAll(/(\w+)\s*:\s*'[^']+'(?:\s*\|\s*'[^']+')+\s*[;,]/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

/**
 * The roster: keys of `PROD_CONFIG_ENUM_FIELDS`. Each enum field must be listed
 * here with its declared allowed literals. Scoped to the const block (between the
 * const declaration and the `isAllowedEnumValue` helper that immediately follows).
 */
function readRosterKeys(): string[] {
  const src = readSource();
  const start = src.indexOf('const PROD_CONFIG_ENUM_FIELDS');
  const end = src.indexOf('const isAllowedEnumValue');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('PROD_CONFIG_ENUM_FIELDS const block not found');
  }
  const block = src.slice(start, end);
  const names = [...block.matchAll(/(\w+)\s*:\s*\[/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

/**
 * Fields actually VALIDATED by an enum check inside `validateConfigOverrides`,
 * detected via their `PROD_CONFIG_ENUM_FIELDS.<field>` reference. Scoped to the
 * function body so a coincidental reference elsewhere cannot widen the set.
 */
function readValidatedEnumFields(): string[] {
  const src = readSource();
  const fnStart = src.indexOf('static validateConfigOverrides');
  if (fnStart === -1) throw new Error('validateConfigOverrides not found');
  const fnEnd = src.indexOf('private loadConfigOverrides', fnStart);
  const body = fnEnd === -1 ? src.slice(fnStart) : src.slice(fnStart, fnEnd);
  const names = [...body.matchAll(/PROD_CONFIG_ENUM_FIELDS\.(\w+)/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}

describe('REQ-055: validateConfigOverrides covers every persisted enum field (enum closed-set anchor)', () => {
  const declared = readDeclaredEnumFields();
  const roster = readRosterKeys();
  const validated = readValidatedEnumFields();

  it('all three extraction sets are non-empty (anchor is wired to real source)', () => {
    expect(declared.length).toBeGreaterThan(0);
    expect(roster.length).toBeGreaterThan(0);
    expect(validated.length).toBeGreaterThan(0);
  });

  it('every declared enum field is in the roster (no unrostered literal-union)', () => {
    const missing = declared.filter((f) => !roster.includes(f));
    expect(missing).toEqual([]);
  });

  it('every roster key is a declared enum field (no orphan roster entries)', () => {
    const orphan = roster.filter((f) => !declared.includes(f));
    expect(orphan).toEqual([]);
  });

  it('every roster key is validated in validateConfigOverrides (no silently un-enforced enum)', () => {
    const unenforced = roster.filter((f) => !validated.includes(f));
    expect(unenforced).toEqual([]);
  });

  it('every validation targets a roster key (no enum checks outside the roster)', () => {
    const orphan = validated.filter((f) => !roster.includes(f));
    expect(orphan).toEqual([]);
  });

  it('declared == roster == validated (full three-way closed-set equality)', () => {
    expect(new Set(declared)).toEqual(new Set(roster));
    expect(new Set(roster)).toEqual(new Set(validated));
  });
});

describe('REQ-055: out-of-set enum values are rejected at the restore boundary (defect instance)', () => {
  // Before REQ-055 these all returned `true` — the out-of-set string survived
  // `typeof === 'string'` and round-tripped into getConfig(). Each row is the
  // defect instance the closed-set anchor above structurally machine-enforces.
  it.each([
    ['name', { name: 'attacker' }],
    ['performance.cacheStrategy', { performance: { cacheStrategy: 'bogus' } }],
    ['performance.optimizationLevel', { performance: { optimizationLevel: 'turbo' } }],
    ['monitoring.logLevel', { monitoring: { logLevel: 'trace' } }],
    ['export.defaultFormat', { export: { defaultFormat: 'exe' } }],
  ] as const)('rejects out-of-set %s', (_label, override) => {
    expect(ProductionConfigManager.validateConfigOverrides(override)).toBe(false);
  });

  it.each([
    ['name', { name: 'production' }],
    ['performance.cacheStrategy', { performance: { cacheStrategy: 'redis' } }],
    ['performance.optimizationLevel', { performance: { optimizationLevel: 'aggressive' } }],
    ['monitoring.logLevel', { monitoring: { logLevel: 'warn' } }],
    ['export.defaultFormat', { export: { defaultFormat: 'webm' } }],
  ] as const)('accepts in-set %s', (_label, override) => {
    expect(ProductionConfigManager.validateConfigOverrides(override)).toBe(true);
  });

  it('non-string enum field is still rejected (type guard intact)', () => {
    expect(ProductionConfigManager.validateConfigOverrides({ name: 123 })).toBe(false);
  });

  it('a valid full config round-trips through the validator', () => {
    expect(
      ProductionConfigManager.validateConfigOverrides({
        name: 'staging',
        performance: { cacheStrategy: 'hybrid', optimizationLevel: 'standard' },
        monitoring: { logLevel: 'info' },
        export: { defaultFormat: 'mp4' },
      }),
    ).toBe(true);
  });
});
