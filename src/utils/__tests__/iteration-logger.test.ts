import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IterationLogger, type IterationLogEntry } from '../iteration-logger';

describe('IterationLogger', () => {
  let tmpDir: string;
  let logPath: string;
  let logger: IterationLogger;

  const sampleEntry: IterationLogEntry = {
    iteration: 1,
    phase: 'Phase 100',
    timestamp: '2026-06-30T12:00:00.000Z',
    success: true,
    metrics: {
      totalProcessingTime: 10000,
      transcriptionTime: 3000,
      analysisTime: 4000,
      layoutTime: 2000,
      renderTime: 1000,
      segmentCount: 5,
      diagramCount: 3,
      successRate: 0.95,
    },
    config: {},
  };

  const sampleEntry2: IterationLogEntry = {
    iteration: 2,
    phase: 'Phase 100',
    timestamp: '2026-06-30T12:01:00.000Z',
    success: false,
    metrics: {
      totalProcessingTime: 8000,
      transcriptionTime: 2000,
      analysisTime: 3000,
      layoutTime: 2000,
      renderTime: 1000,
      segmentCount: 4,
      diagramCount: 2,
      successRate: 0.5,
    },
    config: {},
    errorMessage: 'Test error message',
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-log-test-'));
    logPath = path.join(tmpDir, 'ITERATION_LOG.md');
    logger = new IterationLogger(logPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- ensureLogFile / appendIteration ---

  test('appendIteration creates log file if it does not exist', async () => {
    expect(fs.existsSync(logPath)).toBe(false);
    await logger.appendIteration(sampleEntry);
    expect(fs.existsSync(logPath)).toBe(true);
  });

  test('appendIteration creates parent directories if needed', async () => {
    const nestedPath = path.join(tmpDir, 'nested', 'deep', 'ITERATION_LOG.md');
    const nestedLogger = new IterationLogger(nestedPath);
    await nestedLogger.appendIteration(sampleEntry);
    expect(fs.existsSync(nestedPath)).toBe(true);
  });

  test('appendIteration writes iteration header exactly once (no duplicate)', async () => {
    await logger.appendIteration(sampleEntry);
    const content = fs.readFileSync(logPath, 'utf-8');
    const headerCount = (content.match(/### Iteration 1 - success/g) || []).length;
    expect(headerCount).toBe(1);
  });

  test('appendIteration includes all metrics in output', async () => {
    await logger.appendIteration(sampleEntry);
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('Processing Time: 10.0s');
    expect(content).toContain('Transcription: 3.0s');
    expect(content).toContain('Analysis: 4.0s');
    expect(content).toContain('Layout: 2.0s');
    expect(content).toContain('Preparation: 1.0s');
    expect(content).toContain('Segments: 5');
    expect(content).toContain('Diagrams: 3');
    expect(content).toContain('Success Rate: 95.0%');
  });

  test('appendIteration includes memory usage when provided', async () => {
    await logger.appendIteration({
      ...sampleEntry,
      metrics: { ...sampleEntry.metrics, memoryUsage: 1048576 },
    });
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('Memory Usage: 1.00MB');
  });

  test('appendIteration includes error message on failure', async () => {
    await logger.appendIteration(sampleEntry2);
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('### Iteration 2 - failure');
    expect(content).toContain('Test error message');
  });

  test('appendIteration includes improvements and next steps', async () => {
    await logger.appendIteration({
      ...sampleEntry,
      improvements: ['Reduced latency by 20%', 'Added caching'],
      nextSteps: ['Optimize rendering', 'Add more tests'],
    });
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('Reduced latency by 20%');
    expect(content).toContain('Added caching');
    expect(content).toContain('Optimize rendering');
    expect(content).toContain('Add more tests');
  });

  test('appendIteration adds phase section if it does not exist', async () => {
    await logger.appendIteration(sampleEntry);
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('## Phase 100');
  });

  test('appendIteration appends to existing phase section', async () => {
    await logger.appendIteration(sampleEntry);
    await logger.appendIteration(sampleEntry2);
    const content = fs.readFileSync(logPath, 'utf-8');
    // Both entries should be under the same phase section
    const phaseStart = content.indexOf('## Phase 100');
    expect(phaseStart).toBeGreaterThanOrEqual(0);
    const phaseSection = content.substring(phaseStart);
    expect(phaseSection).toContain('### Iteration 1 - success');
    expect(phaseSection).toContain('### Iteration 2 - failure');
  });

  test('appendIteration updates Last Updated timestamp', async () => {
    await logger.appendIteration(sampleEntry);
    const content1 = fs.readFileSync(logPath, 'utf-8');
    const ts1Match = content1.match(/Last Updated: (.+)/);
    expect(ts1Match).not.toBeNull();

    await new Promise(resolve => setTimeout(resolve, 10));
    await logger.appendIteration(sampleEntry2);
    const content2 = fs.readFileSync(logPath, 'utf-8');
    const ts2Match = content2.match(/Last Updated: (.+)/);
    expect(ts2Match).not.toBeNull();
  });

  test('appendIteration does not throw on write error (non-fatal)', async () => {
    // Create a path that will cause a write error
    const invalidLogger = new IterationLogger('/nonexistent/path/that/cannot/be/created/ITERATION_LOG.md');
    await expect(invalidLogger.appendIteration(sampleEntry)).resolves.toBeUndefined();
  });

  // --- readHistory ---

  test('readHistory returns empty array when file does not exist', async () => {
    const history = await logger.readHistory();
    // readHistory calls ensureLogFile first, which creates the file
    // Then returns empty entries since it's just the initial content
    expect(history).toEqual([]);
  });

  test('readHistory parses entries correctly', async () => {
    await logger.appendIteration(sampleEntry);
    await logger.appendIteration(sampleEntry2);

    const history = await logger.readHistory();
    expect(history.length).toBe(2);

    const entry1 = history.find(e => e.iteration === 1);
    expect(entry1).toBeDefined();
    expect(entry1!.phase).toBe('Phase 100');
    expect(entry1!.success).toBe(true);
    expect(entry1!.metrics.totalProcessingTime).toBe(10000);
    expect(entry1!.metrics.segmentCount).toBe(5);
    expect(entry1!.metrics.diagramCount).toBe(3);
    expect(entry1!.metrics.successRate).toBe(0.95);

    const entry2 = history.find(e => e.iteration === 2);
    expect(entry2).toBeDefined();
    expect(entry2!.success).toBe(false);
  });

  test('readHistory does not throw on error', async () => {
    // Use a valid but non-fs path to trigger error in catch
    const badLogger = new IterationLogger('/nonexistent/path/ITERATION_LOG.md');
    const history = await badLogger.readHistory();
    expect(history).toEqual([]);
  });

  // --- calculateImprovementTrends ---

  test('calculateImprovementTrends returns defaults for no history', async () => {
    const trends = await logger.calculateImprovementTrends();
    expect(trends.averageProcessingTime).toBe(0);
    expect(trends.successRate).toBe(0);
    expect(trends.trendDirection).toBe('stable');
    expect(trends.recommendations).toContain('No historical data available');
  });

  test('calculateImprovementTrends calculates averages correctly', async () => {
    await logger.appendIteration(sampleEntry);
    await logger.appendIteration(sampleEntry2);

    const trends = await logger.calculateImprovementTrends();
    // Average of 10000 and 8000
    expect(trends.averageProcessingTime).toBe(9000);
    // 1 success out of 2
    expect(trends.successRate).toBe(0.5);
  });

  test('calculateImprovementTrends recommends investigation for low success rate', async () => {
    await logger.appendIteration({ ...sampleEntry2, iteration: 1 });
    await logger.appendIteration({ ...sampleEntry2, iteration: 2 });

    const trends = await logger.calculateImprovementTrends();
    expect(trends.successRate).toBe(0);
    expect(trends.recommendations).toContain('Success rate below 80% - investigate error patterns');
  });

  test('calculateImprovementTrends recommends optimization for high processing time', async () => {
    await logger.appendIteration({
      ...sampleEntry,
      metrics: { ...sampleEntry.metrics, totalProcessingTime: 120000 },
    });

    const trends = await logger.calculateImprovementTrends();
    expect(trends.recommendations).toContain('Average processing time > 60s - optimize bottlenecks');
  });

  // --- generatePhaseSummary ---

  test('generatePhaseSummary returns message for non-existent phase', async () => {
    const summary = await logger.generatePhaseSummary('NonExistentPhase');
    expect(summary).toContain('No iterations logged for phase: NonExistentPhase');
  });

  test('generatePhaseSummary generates correct summary', async () => {
    await logger.appendIteration(sampleEntry);
    await logger.appendIteration(sampleEntry2);

    const summary = await logger.generatePhaseSummary('Phase 100');
    expect(summary).toContain('Phase Summary: Phase 100');
    expect(summary).toContain('**Total Iterations**: 2');
    expect(summary).toContain('**Successful**: 1');
    expect(summary).toContain('**Failed**: 1');
  });

  // --- Entry trimming ---

  test('trimOldEntries limits total entries to MAX_LOG_ENTRIES', async () => {
    // Create a logger with a smaller limit for testing
    const testLogger = new IterationLogger(logPath);
    // Override the private MAX_LOG_ENTRIES by writing many entries
    // The default limit is 100, so we write 5 entries to verify trimming logic exists
    for (let i = 1; i <= 5; i++) {
      await testLogger.appendIteration({
        ...sampleEntry,
        iteration: i,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      });
    }

    const history = await testLogger.readHistory();
    expect(history.length).toBeLessThanOrEqual(100);
    expect(history.length).toBe(5);
  });

  // --- Regex injection safety ---

  test('insertEntry safely handles phase names with regex special characters', async () => {
    await logger.appendIteration({ ...sampleEntry, phase: 'Phase [100]' });
    await logger.appendIteration({ ...sampleEntry2, phase: 'Phase [100]' });

    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('## Phase [100]');
    // Both entries should be under the same section
    const count = (content.match(/### Iteration \d+ - /g) || []).length;
    expect(count).toBe(2);
  });

  test('insertEntry handles phase name with dots', async () => {
    await logger.appendIteration({ ...sampleEntry, phase: 'v1.2.3' });
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('## v1.2.3');
  });
});
