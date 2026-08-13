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
 * checklist — the anchor cannot drift at the FIELD level: when a 6th enum field
 * is added to the type, the type edit, the roster edit, and the validation edit
 * must all land in the same commit or this pin fires.
 *
 * This closes field-NAME drift but is BLIND to value drift: the boolean and
 * finiteness tails are drift-proof because their allowed set is structural
 * (`: boolean`, `isPositiveFiniteNumber`), whereas the enum tail's allowed
 * VALUES live in the hand-maintained `PROD_CONFIG_ENUM_FIELDS` arrays. Adding a
 * literal to a union (e.g. `logLevel: 'trace'`) without the matching roster
 * entry leaves the validator silently rejecting a now-type-legal value, and the
 * field-level anchor never fires because the field NAME is unchanged. The
 * REQ-058 describe block below closes that gap by asserting, per field, that
 * the interface union literals equal the roster array literals — making all
 * three tails of the boundary equally drift-proof rather than only two.
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

/**
 * For each enum field, the literal VALUES declared in the interface union —
 * `{ field: ['a', 'b'] }`. Twin of `readRosterLiterals()`. The field-NAME
 * 3-way equality above proves every literal-union field is rostered and
 * validated, but it is BLIND to the allowed VALUES: the boolean/finiteness
 * tails are drift-proof because their allowed set is structural (`: boolean`,
 * `isPositiveFiniteNumber`), whereas the enum tail's allowed values live in a
 * hand-maintained roster. Adding a literal to a union (e.g.
 * `logLevel: 'error' | … | 'trace'`) without the matching roster entry leaves
 * the validator silently REJECTING the now-type-legal value — a real defect —
 * yet the field-level anchor never fires because the field NAME is unchanged.
 * This value-level twin reads the union literals straight from the interface
 * and asserts them equal to the roster literals, so all three tails of the
 * declare→validate→persist→round-trip boundary are equally drift-proof rather
 * than only two. Scoped to the same interface/const region as
 * `readDeclaredEnumFields()`; the regex captures the full union body so every
 * `'literal'` in the type is extracted.
 */
function readDeclaredEnumLiterals(): Record<string, string[]> {
  const src = readSource();
  const start = src.indexOf('export interface ProductionEnvironment');
  const end = src.indexOf('const PROD_CONFIG_ENUM_FIELDS');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('interface/const region not found in production-config.ts');
  }
  const region = src.slice(start, end);
  const out: Record<string, string[]> = {};
  const matches = [...region.matchAll(/(\w+)\s*:\s*('[^']+'(?:\s*\|\s*'[^']+')+)\s*[;,]/g)];
  for (const m of matches) {
    const literals = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    out[m[1]] = [...new Set(literals)].sort();
  }
  return out;
}

/**
 * For each enum field, the literal VALUES listed in the `PROD_CONFIG_ENUM_FIELDS`
 * roster array — `{ field: ['a', 'b'] }`. Scoped to the const block (between
 * the const declaration and the `isAllowedEnumValue` helper) so the interface
 * unions cannot be matched, and so a value added only to the type without the
 * roster is caught as drift against `readDeclaredEnumLiterals()`.
 */
function readRosterLiterals(): Record<string, string[]> {
  const src = readSource();
  const start = src.indexOf('const PROD_CONFIG_ENUM_FIELDS');
  const end = src.indexOf('const isAllowedEnumValue');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('PROD_CONFIG_ENUM_FIELDS const block not found');
  }
  const block = src.slice(start, end);
  const out: Record<string, string[]> = {};
  const matches = [...block.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)];
  for (const m of matches) {
    const literals = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    out[m[1]] = [...new Set(literals)].sort();
  }
  return out;
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

/**
 * VALUE-LEVEL DRIFT GUARD (REQ-058) — the field-NAME anchor above is blind to
 * the allowed literals. The boolean/finiteness tails are drift-proof because
 * their allowed set is structural; the enum tail's allowed values live in the
 * hand-maintained `PROD_CONFIG_ENUM_FIELDS` roster. Asserting the roster array
 * literals equal the interface union literals per field makes the enum tail
 * drift-proof too: a literal added to a type without the roster (validator now
 * wrongly rejects a type-legal value) OR added to the roster without the type
 * (validator now wrongly accepts a type-illegal value) both fire this pin.
 *
 * RED VERIFICATION
 * ----------------
 * Adding `'trace'` to the `logLevel` interface union only (not the roster)
 * makes the field-level anchor above still PASS — the field NAME `logLevel` is
 * unchanged in all three sets — but flips this value-level guard RED with
 * `logLevel: interface=[…,trace,…] roster=[…]`, which is exactly the drift the
 * field-level anchor cannot catch.
 */
describe('REQ-058: roster values match interface unions (value-level drift-proof)', () => {
  const declaredLits = readDeclaredEnumLiterals();
  const rosterLits = readRosterLiterals();
  const fields = [...new Set([...Object.keys(declaredLits), ...Object.keys(rosterLits)])];

  it('value-level extraction found at least one field (anchor is wired to real source)', () => {
    expect(fields.length).toBeGreaterThan(0);
  });

  it('every field: interface union literals == roster array literals', () => {
    const drift: string[] = [];
    for (const field of fields) {
      const d = declaredLits[field] ?? [];
      const r = rosterLits[field] ?? [];
      if (JSON.stringify(d) !== JSON.stringify(r)) {
        drift.push(`${field}: interface=[${d.join(',')}] roster=[${r.join(',')}]`);
      }
    }
    expect(drift).toEqual([]);
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
