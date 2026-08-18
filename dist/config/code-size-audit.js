import {
  safeToLocaleString
} from "../chunk-6OZITFG4.js";
import "../chunk-GW232JDV.js";
import {
  logger
} from "../chunk-NKCCCSWP.js";

// src/config/code-size-audit.ts
import * as fs from "fs";
import * as path from "path";
var SYSTEM_CONSTITUTION_LIMITS = {
  maxFiles: 380,
  maxLines: 115e3,
  maxLinesPerFile: 2e3,
  maxDependencies: 110
};
function evaluateAudit(metrics, limits = SYSTEM_CONSTITUTION_LIMITS) {
  const warnings = [];
  if (metrics.fileCount > limits.maxFiles) {
    warnings.push(
      `File count ${metrics.fileCount} exceeds limit of ${limits.maxFiles}`
    );
  }
  if (metrics.lineCount > limits.maxLines) {
    warnings.push(
      `Total lines ${safeToLocaleString(metrics.lineCount)} exceeds limit of ${safeToLocaleString(limits.maxLines)}`
    );
  }
  if (metrics.dependencyCount > limits.maxDependencies) {
    warnings.push(
      `Dependency count ${metrics.dependencyCount} exceeds limit of ${limits.maxDependencies}`
    );
  }
  if (metrics.largestFile && metrics.largestFile.lines > limits.maxLinesPerFile) {
    warnings.push(
      `File ${metrics.largestFile.path} has ${metrics.largestFile.lines} lines (limit: ${limits.maxLinesPerFile})`
    );
  }
  return {
    metrics,
    limits,
    warnings,
    isCompliant: warnings.length === 0
  };
}
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  ".module",
  "test-batch-output",
  "public"
]);
var SOURCE_EXTENSIONS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx"]);
function collectMetrics(rootDir, options) {
  const srcOnly = options?.srcOnly !== false;
  const files = [];
  function walk(dir) {
    let entries;
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
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n").length;
          files.push({ path: path.relative(rootDir, fullPath), lines });
        }
      }
    }
  }
  if (srcOnly) {
    const srcDir = path.join(rootDir, "src");
    walk(srcDir);
  } else {
    walk(rootDir);
  }
  const fileCount = files.length;
  const lineCount = files.reduce((sum, f) => sum + f.lines, 0);
  const largestFile = files.length > 0 ? files.reduce((max, f) => f.lines > max.lines ? f : max, files[0]) : null;
  return { fileCount, lineCount, dependencyCount: 0, files, largestFile };
}
function readDependencyCount(packageJsonPath) {
  const raw = fs.readFileSync(packageJsonPath, "utf-8");
  let pkg;
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
function runAudit(rootDir, packageJsonPath, limits, options) {
  const effectiveLimits = {
    ...SYSTEM_CONSTITUTION_LIMITS,
    ...limits
  };
  const metrics = collectMetrics(rootDir, options);
  metrics.dependencyCount = readDependencyCount(packageJsonPath);
  return evaluateAudit(metrics, effectiveLimits);
}
export {
  SYSTEM_CONSTITUTION_LIMITS,
  collectMetrics,
  evaluateAudit,
  readDependencyCount,
  runAudit
};
