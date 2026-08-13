/**
 * @jest-environment node
 */
/**
 * Boundary → generation-output audit for `monitoring.logLevel` (REQ-059).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `monitoring.logLevel` is the only ProductionEnvironment field whose declared
 * literals ('error'|'warn'|'info'|'debug') map 1:1 — with no unit or concept
 * mismatch — onto a real decision core: the logger's `LogLevel` enum. Before
 * REQ-059 the logger hardcoded `LogLevel.INFO`, so the persisted, env-specific,
 * validated logLevel (development→debug, staging→info, production→warn)
 * traversed the full declare→validate→persist→round-trip-restore lifecycle and
 * then reached NOTHING — the canonical dead-field failure mode of this repo's
 * most prolific defect class (boundary→generation: declared + validated +
 * persisted + restored, but never consumed where it decides behaviour).
 *
 * This file is the behavioural pin that `monitoring.logLevel` now reaches the
 * logger and is applied LIVE on mutation — the production-config analog of
 * `pipeline/__tests__/config-boundary-reaches-generation.test.ts`. It uses the
 * REAL logger (no mock): the sibling `production-config.test.ts` mocks the
 * logger to isolate persistence/validation, which would mask exactly the
 * "value reached setLevel" contract under test here.
 *
 * ISOLATION
 * ---------
 * The logger is a process-global singleton. Every case saves the effective
 * level in beforeEach and restores it in afterEach so no level leaks across
 * tests or into unrelated suites sharing the worker. NODE_ENV is likewise
 * saved/restored. Fresh `ProductionConfigManager` instances are used (never the
 * exported singleton) so configOverrides never leak.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProductionConfigManager } from '../production-config';
import { logger, LogLevel } from '@/utils/logger';

// In-memory localStorage so loadConfigOverrides / updateConfig persist are
// deterministic and do not touch the real (absent-in-node) storage.
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('REQ-059: monitoring.logLevel reaches the logger (boundary→generation)', () => {
  let originalNodeEnv: string | undefined;
  let originalLevel: LogLevel;

  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    originalNodeEnv = process.env.NODE_ENV;
    originalLevel = logger.getLevel();
    // 'test' is not a declared environment → falls back to development.
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    logger.setLevel(originalLevel);
  });

  // Env-default mapping: each declared environment's default logLevel must
  // reach the logger when the config owner applies runtime config.
  it('applies the development default logLevel (debug → DEBUG)', () => {
    process.env.NODE_ENV = 'development';
    new ProductionConfigManager().applyRuntimeConfig();
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });

  it('applies the staging default logLevel (info → INFO)', () => {
    process.env.NODE_ENV = 'staging';
    new ProductionConfigManager().applyRuntimeConfig();
    expect(logger.getLevel()).toBe(LogLevel.INFO);
  });

  it('applies the production default logLevel (warn → WARN)', () => {
    process.env.NODE_ENV = 'production';
    new ProductionConfigManager().applyRuntimeConfig();
    expect(logger.getLevel()).toBe(LogLevel.WARN);
  });

  // Exhaustive name→level mapping: every declared literal maps to a DISTINCT
  // LogLevel, so no two log levels collapse and none is unmapped.
  it.each([
    ['error', LogLevel.ERROR],
    ['warn', LogLevel.WARN],
    ['info', LogLevel.INFO],
    ['debug', LogLevel.DEBUG],
  ] as const)('maps monitoring.logLevel=%s → LogLevel %p', (name, expected) => {
    const mgr = new ProductionConfigManager();
    mgr.updateConfig({ monitoring: { logLevel: name } });
    // updateConfig applies live (see below); assert via the explicit bridge too.
    mgr.applyRuntimeConfig();
    expect(logger.getLevel()).toBe(expected);
  });

  // LIVENESS: a persisted override must reach the logger immediately on save,
  // not only on the next dashboard mount.
  it('updateConfig propagates a logLevel override to the logger live', () => {
    process.env.NODE_ENV = 'production'; // env default = warn
    const mgr = new ProductionConfigManager();
    // Construction does NOT touch the logger (no import-time side effect);
    // establish the production default first, then mutate and observe the push.
    mgr.applyRuntimeConfig();
    expect(logger.getLevel()).toBe(LogLevel.WARN);

    mgr.updateConfig({ monitoring: { logLevel: 'error' } });
    // No explicit applyRuntimeConfig() call — updateConfig must push it itself.
    expect(logger.getLevel()).toBe(LogLevel.ERROR);
  });

  it('a logLevel override survives alongside an unrelated section update', () => {
    // Partial update of an unrelated section must not drop the effective
    // logLevel (applyLogLevel reads the MERGED config). Use production (default
    // warn) + a debug override so a revert to the default would be detectable.
    process.env.NODE_ENV = 'production';
    const mgr = new ProductionConfigManager();
    mgr.updateConfig({ monitoring: { logLevel: 'debug' } });
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);

    mgr.updateConfig({ performance: { maxConcurrentJobs: 7 } });
    // logLevel was not in this partial; the merged config still carries debug
    // (a drop would revert to the production default WARN).
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });

  it('resetConfig reverts the logger to the env-default level live', () => {
    process.env.NODE_ENV = 'production'; // env default = warn
    const mgr = new ProductionConfigManager();
    mgr.updateConfig({ monitoring: { logLevel: 'debug' } });
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);

    mgr.resetConfig();
    expect(logger.getLevel()).toBe(LogLevel.WARN);
  });

  it('a persisted logLevel override is re-applied on restore (round-trip liveness)', () => {
    // Persist an override, then construct a FRESH manager (simulating a reload)
    // and apply — the restored override, not the env default, must win.
    process.env.NODE_ENV = 'production'; // env default = warn
    new ProductionConfigManager().updateConfig({ monitoring: { logLevel: 'error' } });
    expect(mockStorage['production-config-overrides']).toBeDefined();

    const reloaded = new ProductionConfigManager();
    reloaded.applyRuntimeConfig();
    expect(logger.getLevel()).toBe(LogLevel.ERROR);
  });
});
