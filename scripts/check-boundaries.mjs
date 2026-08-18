/**
 * Boundary lint + size ratchet for stv-core (CI-fatal).
 *
 * MISSION.md defines this package's responsibility. Two rules keep it honest:
 *
 * 1. DEPENDENCY RULE — no source file may depend on anything outside this
 *    package: no '@/' aliases into a parent tree, no relative escape above
 *    src/, no bare specifiers other than node builtins, the declared runtime
 *    deps, and '@jest/globals' in tests. A violation means the
 *    responsibility boundary is drifting (or already broken) — the module
 *    belongs in the product repo, not here.
 * 2. SIZE RATCHET — implementation lines (tests excluded) and file count
 *    have hard ceilings. The core is a contract layer; when it grows past
 *    the ratchet, stop and split, don't stretch the ceiling.
 */
import { readFileSync, globSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const RUNTIME_DEPS = new Set(['clsx', 'tailwind-merge']);
const TEST_ALLOWED = new Set(['@jest/globals']);
const isBuiltin = (spec) =>
  spec.startsWith('node:') || builtinModules.includes(spec);

const MAX_IMPL_LINES = 6000;
const MAX_FILES = 90;

const SRC = resolve(process.cwd(), 'src');
const errors = [];

const allFiles = new Set(
  globSync('src/**/*.ts').map((p) => resolve(process.cwd(), p))
);

let implLines = 0;
let fileCount = 0;

for (const rel of globSync('src/**/*.ts')) {
  const abs = resolve(process.cwd(), rel);
  const isTest = rel.includes('__tests__') || /\.test\.ts$/.test(rel);
  if (!isTest) {
    fileCount += 1;
    implLines += readFileSync(abs, 'utf8').split('\n').length;
  }
  const src = readFileSync(abs, 'utf8');
  const re = /(?:from\s+|import\s*\(\s*|jest\.mock\(\s*|jest\.unstable_mockModule\(\s*)(['"])([^'"\n]+)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[2];
    if (spec.startsWith('.')) {
      const base = resolve(dirname(abs), spec);
      const hit = [base + '.ts', join(base, 'index.ts')].find((c) =>
        allFiles.has(c)
      );
      if (!hit || !hit.startsWith(SRC)) {
        errors.push(`${rel}: relative import escapes src/ -> ${spec}`);
      }
    } else if (spec.startsWith('@/')) {
      // internal alias (jest moduleNameMapper): must resolve inside src/
      const base = resolve(SRC, spec.slice(2));
      const hit = [base + '.ts', join(base, 'index.ts')].find((c) =>
        allFiles.has(c)
      );
      if (!hit) {
        errors.push(`${rel}: alias does not resolve inside src/ -> ${spec}`);
      }
    } else if (spec.startsWith('@')) {
      if (!(isTest && TEST_ALLOWED.has(spec))) {
        errors.push(`${rel}: scoped dependency not allowed -> ${spec}`);
      }
    } else if (
      !isBuiltin(spec) &&
      !RUNTIME_DEPS.has(spec) &&
      !(isTest && spec === 'jest')
    ) {
      errors.push(`${rel}: undeclared dependency -> ${spec}`);
    }
  }
}

if (implLines > MAX_IMPL_LINES) {
  errors.push(
    `size ratchet: ${implLines} impl lines > ${MAX_IMPL_LINES} (split instead of stretching)`
  );
}
if (fileCount > MAX_FILES) {
  errors.push(`size ratchet: ${fileCount} impl files > ${MAX_FILES}`);
}

if (errors.length > 0) {
  console.error(`boundary check FAILED (${errors.length}):\n` + errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
console.log(
  `boundary OK: ${fileCount} impl files, ${implLines} impl lines (limits ${MAX_FILES}/${MAX_IMPL_LINES})`
);
