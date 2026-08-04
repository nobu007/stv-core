/**
 * REQ-102: Code Size Automatic Audit
 *
 * Audits code size against SYSTEM_CONSTITUTION V2.6 limits.
 * Outputs warnings when limits are exceeded but does not block the build.
 *
 * Limits (V2.6):
 * - Total files: 380 or fewer
 * - Total lines: 115,000 or fewer
 * - Per-file max: 2,000 lines
 * - Dependencies: 110 packages or fewer
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { safeToLocaleString } from '../utils/guards';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeSizeLimits {
  maxFiles: number;
  maxLines: number;
  maxLinesPerFile: number;
  maxDependencies: number;
}

export interface FileMetrics {
  path: string;
  lines: number;
}

export interface CodeSizeMetrics {
  fileCount: number;
  lineCount: number;
  dependencyCount: number;
  files: FileMetrics[];
  largestFile: FileMetrics | null;
}

export interface CodeSizeAuditResult {
  metrics: CodeSizeMetrics;
  limits: CodeSizeLimits;
  warnings: string[];
  isCompliant: boolean;
}

// ---------------------------------------------------------------------------
// Constants — SYSTEM_CONSTITUTION V2.6
// ---------------------------------------------------------------------------

export const SYSTEM_CONSTITUTION_LIMITS: CodeSizeLimits = {
  maxFiles: 380,
  maxLines: 115_000,
  maxLinesPerFile: 2_000,
  maxDependencies: 110,
};

// ---------------------------------------------------------------------------
// Pure evaluation (testable without filesystem)
// ---------------------------------------------------------------------------

/**
 * Evaluate collected metrics against limits and produce an audit result.
 * This is a pure function — no side effects.
 */
export function evaluateAudit(
  metrics: CodeSizeMetrics,
  limits: CodeSizeLimits = SYSTEM_CONSTITUTION_LIMITS,
): CodeSizeAuditResult {
  const warnings: string[] = [];

  if (metrics.fileCount > limits.maxFiles) {
    warnings.push(
      `File count ${metrics.fileCount} exceeds limit of ${limits.maxFiles}`,
    );
  }

  if (metrics.lineCount > limits.maxLines) {
    warnings.push(
      `Total lines ${safeToLocaleString(metrics.lineCount)} exceeds limit of ${safeToLocaleString(limits.maxLines)}`,
    );
  }

  if (metrics.dependencyCount > limits.maxDependencies) {
    warnings.push(
      `Dependency count ${metrics.dependencyCount} exceeds limit of ${limits.maxDependencies}`,
    );
  }

  if (metrics.largestFile && metrics.largestFile.lines > limits.maxLinesPerFile) {
    warnings.push(
      `File ${metrics.largestFile.path} has ${metrics.largestFile.lines} lines (limit: ${limits.maxLinesPerFile})`,
    );
  }

  return {
    metrics,
    limits,
    warnings,
    isCompliant: warnings.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Filesystem collection
// ---------------------------------------------------------------------------

/** Directories to skip when walking the source tree. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  '.module',
  'test-batch-output',
  'public',
]);

/** Extensions counted as source code. */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

export interface CollectOptions {
  /** When true, only walk the `src/` subdirectory. Defaults to true. */
  srcOnly?: boolean;
}

/**
 * Recursively walk `rootDir` and return metrics for every source file found.
 * By default only walks `src/` (REQ-104: aligns audit scope with
 * SYSTEM_CONSTITUTION limits which are defined for src/ only).
 */
export function collectMetrics(
  rootDir: string,
  options?: CollectOptions,
): CodeSizeMetrics {
  const srcOnly = options?.srcOnly !== false; // default true
  const files: FileMetrics[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      logger.warn(`[code-size-audit] Could not read directory "${dir}":`, error);
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SOURCE_EXTENSIONS.has(ext)) {
          const fullPath = path.join(dir, entry.name);
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n').length;
          files.push({ path: path.relative(rootDir, fullPath), lines });
        }
      }
    }
  }

  if (srcOnly) {
    const srcDir = path.join(rootDir, 'src');
    walk(srcDir);
  } else {
    walk(rootDir);
  }

  const fileCount = files.length;
  const lineCount = files.reduce((sum, f) => sum + f.lines, 0);
  const largestFile = files.length > 0
    ? files.reduce((max, f) => (f.lines > max.lines ? f : max), files[0])
    : null;

  return { fileCount, lineCount, dependencyCount: 0, files, largestFile };
}

/**
 * Read the total dependency count (deps + devDeps) from a package.json file.
 */
export function readDependencyCount(packageJsonPath: string): number {
  const raw = fs.readFileSync(packageJsonPath, 'utf-8');
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(raw);
  } catch (e) {
    logger.warn(`Failed to parse ${packageJsonPath}: ${String(e)}; returning 0 dependencies.`);
    return 0;
  }
  const deps = Object.keys(pkg.dependencies ?? {}).length;
  const devDeps = Object.keys(pkg.devDependencies ?? {}).length;
  return deps + devDeps;
}

/**
 * Run the full audit: collect metrics, evaluate, and return the result.
 */
export function runAudit(
  rootDir: string,
  packageJsonPath: string,
  limits?: Partial<CodeSizeLimits>,
  options?: CollectOptions,
): CodeSizeAuditResult {
  const effectiveLimits: CodeSizeLimits = {
    ...SYSTEM_CONSTITUTION_LIMITS,
    ...limits,
  };

  const metrics = collectMetrics(rootDir, options);
  metrics.dependencyCount = readDependencyCount(packageJsonPath);

  return evaluateAudit(metrics, effectiveLimits);
}
