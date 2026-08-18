/**
 * Build the runnable ESM layer of dist/: tsc (via `npm run build`) emits
 * declarations only — extensionless TS source cannot be emitted as runnable
 * node ESM — so esbuild bundles every source file as an entry point with
 * code splitting, which rewrites internal specifiers to real paths.
 */
import { build } from 'esbuild';
import { globSync } from 'node:fs';

const entries = globSync('src/**/*.ts').filter(
  (p) =>
    !p.includes('__tests__') &&
    !/\.test\.ts$/.test(p) &&
    !p.startsWith('src/test-support/')
);
if (entries.length === 0) {
  throw new Error('no entry points found');
}

await build({
  entryPoints: entries,
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  target: 'es2020',
  external: ['clsx', 'tailwind-merge'],
  logLevel: 'info',
});
