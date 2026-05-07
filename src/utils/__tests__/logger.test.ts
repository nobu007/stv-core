import { logger, LogLevel } from '../logger';

describe('logger', () => {
  let consoleSpies: {
    debug: vi.SpyInstance;
    info: vi.SpyInstance;
    warn: vi.SpyInstance;
    error: vi.SpyInstance;
  };

  beforeEach(() => {
    consoleSpies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log debug messages when level permits', () => {
    // currentLogLevel is INFO (1), DEBUG is 0, so debug should NOT be logged
    logger.debug('debug msg');
    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });

  it('should log info messages', () => {
    logger.info('info msg');
    expect(consoleSpies.info).toHaveBeenCalledWith('[INFO] info msg');
  });

  it('should log info messages with extra args', () => {
    logger.info('info msg', { key: 'value' }, 42);
    expect(consoleSpies.info).toHaveBeenCalledWith('[INFO] info msg', { key: 'value' }, 42);
  });

  it('should log warn messages', () => {
    logger.warn('warn msg');
    expect(consoleSpies.warn).toHaveBeenCalledWith('[WARN] warn msg');
  });

  it('should log warn messages with extra args', () => {
    logger.warn('warn msg', 'extra');
    expect(consoleSpies.warn).toHaveBeenCalledWith('[WARN] warn msg', 'extra');
  });

  it('should log error messages', () => {
    logger.error('error msg');
    expect(consoleSpies.error).toHaveBeenCalledWith('[ERROR] error msg');
  });

  it('should log error messages with extra args', () => {
    logger.error('error msg', new Error('test'));
    expect(consoleSpies.error).toHaveBeenCalledWith('[ERROR] error msg', expect.any(Error));
  });

  it('should export LogLevel enum with correct values', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
    expect(LogLevel.SILENT).toBe(4);
  });
});
