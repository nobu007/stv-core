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
export declare const SYSTEM_CONSTITUTION_LIMITS: CodeSizeLimits;
/**
 * Evaluate collected metrics against limits and produce an audit result.
 * This is a pure function — no side effects.
 */
export declare function evaluateAudit(metrics: CodeSizeMetrics, limits?: CodeSizeLimits): CodeSizeAuditResult;
export interface CollectOptions {
    /** When true, only walk the `src/` subdirectory. Defaults to true. */
    srcOnly?: boolean;
    /**
     * When true, exclude test files from the count: `__tests__/` directories
     * and `*.test.*` / `*.spec.*` files. Implementation-only accounting — the
     * convention the product repo's constitution (V2.8) ratchets against, so
     * test-suite growth cannot silently eat the size budget.
     */
    implOnly?: boolean;
}
/**
 * Recursively walk `rootDir` and return metrics for every source file found.
 * By default only walks `src/` (REQ-104: aligns audit scope with
 * SYSTEM_CONSTITUTION limits which are defined for src/ only).
 */
export declare function collectMetrics(rootDir: string, options?: CollectOptions): CodeSizeMetrics;
/**
 * Read the total dependency count (deps + devDeps) from a package.json file.
 */
export declare function readDependencyCount(packageJsonPath: string): number;
/**
 * Run the full audit: collect metrics, evaluate, and return the result.
 */
export declare function runAudit(rootDir: string, packageJsonPath: string, limits?: Partial<CodeSizeLimits>, options?: CollectOptions): CodeSizeAuditResult;
