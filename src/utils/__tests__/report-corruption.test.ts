/**
 * Tests for the centralized reportCorruption utility.
 */

import {
  reportCorruption,
  setCorruptionHandler,
  CorruptionReport,
} from '../report-corruption';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '@/utils/logger';

describe('reportCorruption', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setCorruptionHandler(null);
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    setCorruptionHandler(null);
  });

  it('should return a structured report object', () => {
    const report = reportCorruption('TestSource', 'something went wrong');
    expect(report.source).toBe('TestSource');
    expect(report.detail).toBe('something went wrong');
    expect(report.recovered).toBe(true);
    expect(typeof report.timestamp).toBe('string');
    expect(new Date(report.timestamp).getTime()).not.toBeNaN();
  });

  it('should call logger.warn with source and detail', () => {
    reportCorruption('ProductionConfig', 'malformed field type');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Corruption:ProductionConfig]'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('malformed field type'),
    );
  });

  it('should default recovered=true', () => {
    const report = reportCorruption('Src', 'detail');
    expect(report.recovered).toBe(true);
  });

  it('should accept recovered=false', () => {
    const report = reportCorruption('Src', 'detail', false);
    expect(report.recovered).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('recovered=false'),
    );
  });

  it('should forward report to registered handler', () => {
    const handler = jest.fn();
    setCorruptionHandler(handler);

    const report = reportCorruption('Hook', 'bad data');
    expect(handler).toHaveBeenCalledWith(report);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not forward to handler after handler is removed', () => {
    const handler = jest.fn();
    setCorruptionHandler(handler);
    reportCorruption('Hook', 'first');
    expect(handler).toHaveBeenCalledTimes(1);

    setCorruptionHandler(null);
    reportCorruption('Hook', 'second');
    expect(handler).toHaveBeenCalledTimes(1); // still 1, not 2
  });

  it('should not throw when handler throws', () => {
    const throwingHandler = jest.fn(() => { throw new Error('handler crashed'); });
    setCorruptionHandler(throwingHandler);

    expect(() => reportCorruption('Src', 'detail')).not.toThrow();
    expect(throwingHandler).toHaveBeenCalled();
  });

  it('should log handler errors via logger.error', () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const throwingHandler = jest.fn(() => { throw new Error('handler crashed'); });
    setCorruptionHandler(throwingHandler);

    reportCorruption('Src', 'detail');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[report-corruption] Corruption handler threw:'),
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it('should still return report when handler throws', () => {
    const throwingHandler = jest.fn(() => { throw new Error('handler crashed'); });
    setCorruptionHandler(throwingHandler);

    const report = reportCorruption('Src', 'detail');
    expect(report.source).toBe('Src');
    expect(report.detail).toBe('detail');
  });

  it('should handle multiple sequential reports', () => {
    const handler = jest.fn();
    setCorruptionHandler(handler);

    reportCorruption('A', 'first');
    reportCorruption('B', 'second');
    reportCorruption('C', 'third');

    expect(handler).toHaveBeenCalledTimes(3);
    const reports = handler.mock.calls.map((c: unknown[]) => c[0] as CorruptionReport);
    expect(reports[0].source).toBe('A');
    expect(reports[1].source).toBe('B');
    expect(reports[2].source).toBe('C');
  });

  it('should include ISO timestamp', () => {
    const before = new Date().toISOString();
    const report = reportCorruption('T', 'd');
    const after = new Date().toISOString();

    // Timestamp should be between before and after
    expect(report.timestamp >= before).toBe(true);
    expect(report.timestamp <= after).toBe(true);
  });
});
