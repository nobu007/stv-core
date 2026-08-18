/**
 * Post-tsc pass: add .js to extensionless relative specifiers in emitted JS.
 *
 * The sources import each other extensionless (bundler resolution), which node
 * ESM rejects at runtime. tsc does not rewrite them, so this pass does —
 * keeping dist 1:1 with src/ (no chunk indirection). A 1:1 layout matters for
 * more than aesthetics: jest ESM mocking keys on resolved URLs, and esbuild's
 * shared chunks made `@stv/core/utils/logger` unmockable for consumers (the
 * importing module loaded a chunk copy instead).
 */
import { globSync } from 'node:fs';
import { readFileSync, writeFileSync } from 'node:fs';

const SPEC = /(\bfrom\s*|\bimport\s*|\bexport\s+\*\s+from\s*|\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;

let touched = 0;
for (const file of globSync('dist/**/*.js')) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(SPEC, (m, head, q, spec) =>
    /\.[cm]?js$/.test(spec) ? m : `${head}${q}${spec}.js${q}`
  );
  if (out !== src) {
    writeFileSync(file, out);
    touched += 1;
  }
}
console.log(`fix-dist-imports: rewrote specifiers in ${touched} file(s)`);
