/**
 * Tests for code-size-audit.ts (REQ-102)
 *
 * Verifies pure audit evaluation logic, file metrics collection,
 * dependency counting, and limit compliance checking.
 */
import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  evaluateAudit,
  collectMetrics,
  readDependencyCount,
  runAudit,
  SYSTEM_CONSTITUTION_LIMITS,
  type CodeSizeMetrics,
  type CodeSizeLimits,
} from '../code-size-audit';

describe('code-size-audit', () => {
  // --- evaluateAudit (pure function) ---

  describe('evaluateAudit', () => {
    const baseMetrics: CodeSizeMetrics = {
      fileCount: 10,
      lineCount: 5000,
      dependencyCount: 50,
      files: [],
      largestFile: { path: 'src/largest.ts', lines: 500 },
    };

    it('should return compliant when all metrics are within limits', () => {
      const result = evaluateAudit(baseMetrics);
      expect(result.isCompliant).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return non-compliant when file count exceeds limit', () => {
      const metrics: CodeSizeMetrics = { ...baseMetrics, fileCount: 500 };
      const result = evaluateAudit(metrics);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('File count 500 exceeds limit of 340');
    });

    it('should return non-compliant when line count exceeds limit', () => {
      const metrics: CodeSizeMetrics = { ...baseMetrics, lineCount: 150_000 };
      const result = evaluateAudit(metrics);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Total lines 150,000 exceeds limit of 100,000');
    });

    it('should format line count with locale-specific grouping', () => {
      const metrics: CodeSizeMetrics = { ...baseMetrics, lineCount: 123_456 };
      const result = evaluateAudit(metrics);
      expect(result.warnings[0]).toContain('123,456');
    });

    it('should return non-compliant when dependency count exceeds limit', () => {
      const metrics: CodeSizeMetrics = { ...baseMetrics, dependencyCount: 200 };
      const result = evaluateAudit(metrics);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings[0]).toContain('Dependency count 200 exceeds limit of 110');
    });

    it('should return non-compliant when largest file exceeds per-file limit', () => {
      const metrics: CodeSizeMetrics = {
        ...baseMetrics,
        largestFile: { path: 'src/huge.ts', lines: 3000 },
      };
      const result = evaluateAudit(metrics);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings[0]).toContain('src/huge.ts');
      expect(result.warnings[0]).toContain('3000 lines');
      expect(result.warnings[0]).toContain('limit: 2000');
    });

    it('should handle null largestFile gracefully', () => {
      const metrics: CodeSizeMetrics = {
        ...baseMetrics,
        largestFile: null,
      };
      const result = evaluateAudit(metrics);
      expect(result.isCompliant).toBe(true);
    });

    it('should produce multiple warnings when multiple limits exceeded', () => {
      const metrics: CodeSizeMetrics = {
        fileCount: 500,
        lineCount: 200_000,
        dependencyCount: 200,
        files: [],
        largestFile: { path: 'big.ts', lines: 5000 },
      };
      const result = evaluateAudit(metrics);
      expect(result.warnings).toHaveLength(4);
      expect(result.isCompliant).toBe(false);
    });

    it('should accept custom limits', () => {
      const customLimits: CodeSizeLimits = {
        maxFiles: 5,
        maxLines: 1000,
        maxLinesPerFile: 100,
        maxDependencies: 10,
      };
      const result = evaluateAudit(baseMetrics, customLimits);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings).toHaveLength(4);
      expect(result.limits).toEqual(customLimits);
    });

    it('should use SYSTEM_CONSTITUTION_LIMITS by default', () => {
      const result = evaluateAudit(baseMetrics);
      expect(result.limits).toEqual(SYSTEM_CONSTITUTION_LIMITS);
    });

    it('should pass through metrics in result', () => {
      const result = evaluateAudit(baseMetrics);
      expect(result.metrics).toBe(baseMetrics);
    });

    it('should handle edge case: exactly at limit (not exceeding)', () => {
      const metrics: CodeSizeMetrics = {
        fileCount: SYSTEM_CONSTITUTION_LIMITS.maxFiles,
        lineCount: SYSTEM_CONSTITUTION_LIMITS.maxLines,
        dependencyCount: SYSTEM_CONSTITUTION_LIMITS.maxDependencies,
        files: [],
        largestFile: { path: 'x.ts', lines: SYSTEM_CONSTITUTION_LIMITS.maxLinesPerFile },
      };
      const result = evaluateAudit(metrics);
      expect(result.isCompliant).toBe(true);
    });

    it('should handle edge case: one over limit', () => {
      const metrics: CodeSizeMetrics = {
        fileCount: SYSTEM_CONSTITUTION_LIMITS.maxFiles + 1,
        lineCount: SYSTEM_CONSTITUTION_LIMITS.maxLines,
        dependencyCount: SYSTEM_CONSTITUTION_LIMITS.maxDependencies,
        files: [],
        largestFile: { path: 'x.ts', lines: SYSTEM_CONSTITUTION_LIMITS.maxLinesPerFile },
      };
      const result = evaluateAudit(metrics);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings).toHaveLength(1);
    });
  });

  // --- SYSTEM_CONSTITUTION_LIMITS ---

  describe('SYSTEM_CONSTITUTION_LIMITS', () => {
    it('should have correct values per V2.4 constitution', () => {
      expect(SYSTEM_CONSTITUTION_LIMITS.maxFiles).toBe(340);
      expect(SYSTEM_CONSTITUTION_LIMITS.maxLines).toBe(100_000);
      expect(SYSTEM_CONSTITUTION_LIMITS.maxLinesPerFile).toBe(2000);
      expect(SYSTEM_CONSTITUTION_LIMITS.maxDependencies).toBe(110);
    });
  });

  // --- collectMetrics (uses temp directories) ---

  describe('collectMetrics', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-audit-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return zero metrics for empty directory', () => {
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(0);
      expect(metrics.lineCount).toBe(0);
      expect(metrics.largestFile).toBeNull();
      expect(metrics.files).toHaveLength(0);
    });

    it('should count .ts files', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'line1\nline2\nline3');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(1);
      expect(metrics.lineCount).toBe(3);
    });

    it('should count .tsx, .js, .jsx files', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'b.tsx'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'c.js'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'd.jsx'), 'x\n');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(4);
    });

    it('should ignore non-source files', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'b.json'), '{}\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'c.md'), '# Hi\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'd.css'), '.a{}\n');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(1);
    });

    it('should skip excluded directories', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      fs.mkdirSync(path.join(tmpDir, 'dist'));
      fs.mkdirSync(path.join(tmpDir, '.git'));
      fs.mkdirSync(path.join(tmpDir, 'coverage'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'b.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'dist', 'c.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, '.git', 'd.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'coverage', 'e.ts'), 'x\n');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(1);
    });

    it('should walk src/ only by default', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'root.ts'), 'x\n');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(1);
    });

    it('should walk entire dir when srcOnly is false', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'root.ts'), 'x\n');
      const metrics = collectMetrics(tmpDir, { srcOnly: false });
      expect(metrics.fileCount).toBe(2);
    });

    it('should identify largest file', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'small.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'big.ts'), 'a\nb\nc\nd\ne');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.largestFile).not.toBeNull();
      expect(metrics.largestFile!.path).toContain('big.ts');
      expect(metrics.largestFile!.lines).toBe(5);
    });

    it('should count lines correctly for file without trailing newline', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'line1\nline2\nline3');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.lineCount).toBe(3);
    });

    it('should handle nested directories', () => {
      fs.mkdirSync(path.join(tmpDir, 'src', 'deep', 'nested'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'deep', 'b.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'deep', 'nested', 'c.ts'), 'x\n');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(3);
    });

    it('should handle missing src/ directory gracefully', () => {
      const metrics = collectMetrics(tmpDir);
      expect(metrics.fileCount).toBe(0);
      expect(metrics.lineCount).toBe(0);
    });

    it('should return dependencyCount as 0 from collectMetrics', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      const metrics = collectMetrics(tmpDir);
      expect(metrics.dependencyCount).toBe(0);
    });
  });

  // --- readDependencyCount ---

  describe('readDependencyCount', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-count-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should count dependencies + devDependencies', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({
        dependencies: { 'dep1': '1.0.0', 'dep2': '2.0.0' },
        devDependencies: { 'dev1': '1.0.0' },
      }));
      expect(readDependencyCount(pkgPath)).toBe(3);
    });

    it('should handle only dependencies', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({
        dependencies: { 'dep1': '1.0.0' },
      }));
      expect(readDependencyCount(pkgPath)).toBe(1);
    });

    it('should handle only devDependencies', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({
        devDependencies: { 'dev1': '1.0.0', 'dev2': '2.0.0' },
      }));
      expect(readDependencyCount(pkgPath)).toBe(2);
    });

    it('should handle empty package.json', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({}));
      expect(readDependencyCount(pkgPath)).toBe(0);
    });

    it('should handle missing dependencies and devDependencies', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'test' }));
      expect(readDependencyCount(pkgPath)).toBe(0);
    });

    it('should return 0 for invalid JSON', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, '{ invalid json');
      expect(readDependencyCount(pkgPath)).toBe(0);
    });
  });

  // --- runAudit (integration) ---

  describe('runAudit', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should combine collectMetrics + readDependencyCount + evaluateAudit', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\ny');
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { d1: '1.0' },
        devDependencies: { d2: '1.0' },
      }));

      const result = runAudit(tmpDir, path.join(tmpDir, 'package.json'));
      expect(result.metrics.fileCount).toBe(1);
      expect(result.metrics.lineCount).toBe(2);
      expect(result.metrics.dependencyCount).toBe(2);
      expect(result.isCompliant).toBe(true);
    });

    it('should accept custom limits', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');

      const result = runAudit(tmpDir, path.join(tmpDir, 'package.json'), {
        maxFiles: 0,
      });
      expect(result.isCompliant).toBe(false);
      expect(result.warnings).toHaveLength(1);
    });

    it('should accept collectOptions', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'root.ts'), 'x\n');
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');

      const resultSrcOnly = runAudit(tmpDir, path.join(tmpDir, 'package.json'), undefined, { srcOnly: true });
      expect(resultSrcOnly.metrics.fileCount).toBe(1);

      const resultAll = runAudit(tmpDir, path.join(tmpDir, 'package.json'), undefined, { srcOnly: false });
      expect(resultAll.metrics.fileCount).toBe(2);
    });
  });
});
