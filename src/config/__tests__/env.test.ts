import { getConfig, resetConfig, parseBoolean, parseNumber, maskSensitiveValue, getMaskedConfig } from '../env';
import type { ConfigSchema } from '../schema';

describe('parseBoolean', () => {
  it('returns default value when input is undefined', () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean(undefined, false)).toBe(false);
  });

  it('returns default value when input is empty string', () => {
    expect(parseBoolean('', false)).toBe(false);
    expect(parseBoolean('', true)).toBe(true);
  });

  it('parses "true" as true', () => {
    expect(parseBoolean('true', false)).toBe(true);
  });

  it('parses "1" as true', () => {
    expect(parseBoolean('1', false)).toBe(true);
  });

  it('parses "yes" as true', () => {
    expect(parseBoolean('yes', false)).toBe(true);
  });

  it('parses "false" as false', () => {
    expect(parseBoolean('false', true)).toBe(false);
  });

  it('parses "0" as false', () => {
    expect(parseBoolean('0', true)).toBe(false);
  });

  it('parses unknown values as false', () => {
    expect(parseBoolean('maybe', true)).toBe(false);
    expect(parseBoolean('random', false)).toBe(false);
  });
});

describe('parseNumber', () => {
  it('returns default value when input is undefined', () => {
    expect(parseNumber(undefined, 42)).toBe(42);
  });

  it('returns default value when input is empty string', () => {
    expect(parseNumber('', 100)).toBe(100);
  });

  it('parses a valid number string', () => {
    expect(parseNumber('3001', 0)).toBe(3001);
  });

  it('parses a decimal number string', () => {
    expect(parseNumber('0.5', 0)).toBe(0.5);
  });

  it('returns default value for a non-numeric string', () => {
    expect(parseNumber('abc', 99)).toBe(99);
  });

  it('parses negative numbers', () => {
    expect(parseNumber('-5', 0)).toBe(-5);
  });
});

describe('maskSensitiveValue', () => {
  it('masks a long API key', () => {
    const original = 'AIzaSyABCDefghIJKLMnopQRStuvWXYZ123456';
    const result = maskSensitiveValue(original);
    expect(result.startsWith('AIza')).toBe(true);
    expect(result.length).toBe(original.length);
    // All characters after the first 4 should be asterisks
    for (let i = 4; i < result.length; i++) {
      expect(result[i]).toBe('*');
    }
  });

  it('returns **** for short values (less than 8 chars)', () => {
    expect(maskSensitiveValue('short')).toBe('****');
    expect(maskSensitiveValue('1234567')).toBe('****');
  });

  it('shows first 4 chars and masks the rest for 8-char values', () => {
    expect(maskSensitiveValue('12345678')).toBe('1234****');
  });
});

describe('getMaskedConfig', () => {
  const sampleConfig: ConfigSchema = {
    googleApiKey: 'AIzaSyABCDefghIJKLMNOPQRSTUVWXYZ123',
    supabaseUrl: 'https://my-project.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    analysisDisableGemini: false,
    geminiModelOverride: undefined,
    complexityThreshold: 0.2,
    cacheSize: 200,
    cacheTtlMinutes: 120,
    similarityThreshold: 0.9,
    port: 3001,
    nodeEnv: 'development',
  };

  it('masks googleApiKey', () => {
    const masked = getMaskedConfig(sampleConfig);
    expect(masked.googleApiKey).not.toBe(sampleConfig.googleApiKey);
    expect(typeof masked.googleApiKey).toBe('string');
    expect((masked.googleApiKey as string).startsWith('AIza')).toBe(true);
    expect((masked.googleApiKey as string)).toContain('*');
  });

  it('masks supabaseAnonKey', () => {
    const masked = getMaskedConfig(sampleConfig);
    expect(masked.supabaseAnonKey).not.toBe(sampleConfig.supabaseAnonKey);
    expect(typeof masked.supabaseAnonKey).toBe('string');
    expect((masked.supabaseAnonKey as string)).toContain('*');
  });

  it('does not mask supabaseUrl', () => {
    const masked = getMaskedConfig(sampleConfig);
    expect(masked.supabaseUrl).toBe(sampleConfig.supabaseUrl);
  });

  it('preserves numeric values', () => {
    const masked = getMaskedConfig(sampleConfig);
    expect(masked.complexityThreshold).toBe(0.2);
    expect(masked.port).toBe(3001);
    expect(masked.cacheSize).toBe(200);
  });
});

describe('getConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns a valid config when all required env vars are set', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key-12345';
    process.env.SUPABASE_URL = 'https://my-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key-12345';

    const config = getConfig();
    expect(config.googleApiKey).toBe('test-google-api-key-12345');
    expect(config.supabaseUrl).toBe('https://my-project.supabase.co');
    expect(config.supabaseAnonKey).toBe('test-supabase-anon-key-12345');
  });

  it('throws error when required env vars are missing', () => {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    expect(() => getConfig()).toThrow('Configuration validation failed');
  });

  it('does not include API keys in the error message', () => {
    delete process.env.GOOGLE_API_KEY;
    process.env.SUPABASE_URL = 'https://my-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key-12345';

    try {
      getConfig();
      fail('Expected getConfig to throw');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('GOOGLE_API_KEY is required');
      expect(message).not.toContain('test-supabase-anon-key-12345');
    }
  });

  it('applies default values for optional env vars', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key-12345';
    process.env.SUPABASE_URL = 'https://my-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key-12345';
    delete process.env.COMPLEXITY_THRESHOLD;
    delete process.env.CACHE_SIZE;
    delete process.env.CACHE_TTL_MINUTES;
    delete process.env.SIMILARITY_THRESHOLD;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.ANALYSIS_DISABLE_GEMINI;

    const config = getConfig();
    expect(config.complexityThreshold).toBe(0.2);
    expect(config.cacheSize).toBe(200);
    expect(config.cacheTtlMinutes).toBe(120);
    expect(config.similarityThreshold).toBe(0.9);
    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('development');
    expect(config.analysisDisableGemini).toBe(false);
  });

  it('parses custom values from env vars', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key-12345';
    process.env.SUPABASE_URL = 'https://my-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key-12345';
    process.env.COMPLEXITY_THRESHOLD = '0.5';
    process.env.CACHE_SIZE = '500';
    process.env.PORT = '8080';
    process.env.NODE_ENV = 'production';
    process.env.ANALYSIS_DISABLE_GEMINI = 'true';
    process.env.GEMINI_MODEL_OVERRIDE = 'gemini-2.0-flash';

    const config = getConfig();
    expect(config.complexityThreshold).toBe(0.5);
    expect(config.cacheSize).toBe(500);
    expect(config.port).toBe(8080);
    expect(config.nodeEnv).toBe('production');
    expect(config.analysisDisableGemini).toBe(true);
    expect(config.geminiModelOverride).toBe('gemini-2.0-flash');
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key-12345';
    process.env.SUPABASE_URL = 'https://my-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key-12345';

    const config1 = getConfig();
    const config2 = getConfig();
    expect(config1).toBe(config2);
  });

  it('resets singleton and picks up new env values after resetConfig', () => {
    process.env.GOOGLE_API_KEY = 'first-api-key-1234567890';
    process.env.SUPABASE_URL = 'https://first.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'first-anon-key-1234567890';

    const config1 = getConfig();
    expect(config1.googleApiKey).toBe('first-api-key-1234567890');

    resetConfig();

    process.env.GOOGLE_API_KEY = 'second-api-key-1234567890';
    const config2 = getConfig();
    expect(config2.googleApiKey).toBe('second-api-key-1234567890');
    expect(config1).not.toBe(config2);
  });
});
