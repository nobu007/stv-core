import { validateConfig, validateUrl, validateNumberRange } from '../validate';
import type { ValidationError } from '../validate';

describe('validateConfig', () => {
  const validConfig = {
    googleApiKey: 'test-api-key-12345678',
    supabaseUrl: 'https://test-project.supabase.co',
    supabaseAnonKey: 'test-anon-key-12345678',
    analysisDisableGemini: false,
    complexityThreshold: 0.2,
    cacheSize: 200,
    cacheTtlMinutes: 120,
    similarityThreshold: 0.9,
    port: 3001,
    nodeEnv: 'development' as const,
  };

  it('returns no errors for a valid config', () => {
    const errors = validateConfig(validConfig);
    expect(errors).toEqual([]);
  });

  describe('required environment variables', () => {
    it('reports error when GOOGLE_API_KEY is missing', () => {
      const { googleApiKey: _, ...configWithoutKey } = validConfig;
      const errors = validateConfig(configWithoutKey);
      expect(errors).toContainEqual({
        field: 'googleApiKey',
        message: 'GOOGLE_API_KEY is required',
      });
    });

    it('reports error when SUPABASE_URL is missing', () => {
      const { supabaseUrl: _, ...configWithoutUrl } = validConfig;
      const errors = validateConfig(configWithoutUrl);
      expect(errors).toContainEqual({
        field: 'supabaseUrl',
        message: 'SUPABASE_URL is required',
      });
    });

    it('reports error when SUPABASE_ANON_KEY is missing', () => {
      const { supabaseAnonKey: _, ...configWithoutKey } = validConfig;
      const errors = validateConfig(configWithoutKey);
      expect(errors).toContainEqual({
        field: 'supabaseAnonKey',
        message: 'SUPABASE_ANON_KEY is required',
      });
    });

    it('reports multiple errors when multiple required fields are missing', () => {
      const errors = validateConfig({});
      expect(errors.length).toBeGreaterThanOrEqual(3);
      expect(errors).toContainEqual({
        field: 'googleApiKey',
        message: 'GOOGLE_API_KEY is required',
      });
      expect(errors).toContainEqual({
        field: 'supabaseUrl',
        message: 'SUPABASE_URL is required',
      });
      expect(errors).toContainEqual({
        field: 'supabaseAnonKey',
        message: 'SUPABASE_ANON_KEY is required',
      });
    });
  });

  describe('URL validation', () => {
    it('reports error for invalid SUPABASE_URL', () => {
      const errors = validateConfig({
        ...validConfig,
        supabaseUrl: 'not-a-valid-url',
      });
      expect(errors).toContainEqual({
        field: 'supabaseUrl',
        message: 'supabaseUrl is not a valid URL',
      });
    });

    it('accepts valid HTTPS URL', () => {
      const errors = validateConfig({
        ...validConfig,
        supabaseUrl: 'https://my-project.supabase.co',
      });
      expect(errors).not.toContainEqual(
        expect.objectContaining({ field: 'supabaseUrl' })
      );
    });
  });

  describe('numeric range validation', () => {
    it('reports error when COMPLEXITY_THRESHOLD is below 0', () => {
      const errors = validateConfig({
        ...validConfig,
        complexityThreshold: -0.1,
      });
      expect(errors).toContainEqual({
        field: 'complexityThreshold',
        message: 'complexityThreshold must be between 0 and 1',
      });
    });

    it('reports error when COMPLEXITY_THRESHOLD is above 1', () => {
      const errors = validateConfig({
        ...validConfig,
        complexityThreshold: 1.5,
      });
      expect(errors).toContainEqual({
        field: 'complexityThreshold',
        message: 'complexityThreshold must be between 0 and 1',
      });
    });

    it('accepts COMPLEXITY_THRESHOLD at boundary 0', () => {
      const errors = validateConfig({
        ...validConfig,
        complexityThreshold: 0,
      });
      expect(errors).not.toContainEqual(
        expect.objectContaining({ field: 'complexityThreshold' })
      );
    });

    it('accepts COMPLEXITY_THRESHOLD at boundary 1', () => {
      const errors = validateConfig({
        ...validConfig,
        complexityThreshold: 1,
      });
      expect(errors).not.toContainEqual(
        expect.objectContaining({ field: 'complexityThreshold' })
      );
    });

    it('reports error when PORT is below 1024', () => {
      const errors = validateConfig({
        ...validConfig,
        port: 80,
      });
      expect(errors).toContainEqual({
        field: 'port',
        message: 'port must be between 1024 and 65535',
      });
    });

    it('reports error when PORT is above 65535', () => {
      const errors = validateConfig({
        ...validConfig,
        port: 70000,
      });
      expect(errors).toContainEqual({
        field: 'port',
        message: 'port must be between 1024 and 65535',
      });
    });

    it('accepts PORT at boundary 1024', () => {
      const errors = validateConfig({
        ...validConfig,
        port: 1024,
      });
      expect(errors).not.toContainEqual(
        expect.objectContaining({ field: 'port' })
      );
    });

    it('reports error when SIMILARITY_THRESHOLD is out of range', () => {
      const errors = validateConfig({
        ...validConfig,
        similarityThreshold: -1,
      });
      expect(errors).toContainEqual({
        field: 'similarityThreshold',
        message: 'similarityThreshold must be between 0 and 1',
      });
    });
  });

  describe('nodeEnv validation', () => {
    it('accepts valid nodeEnv values', () => {
      for (const env of ['development', 'production', 'test'] as const) {
        const errors = validateConfig({ ...validConfig, nodeEnv: env });
        expect(errors).not.toContainEqual(
          expect.objectContaining({ field: 'nodeEnv' })
        );
      }
    });

    it('reports error for invalid nodeEnv', () => {
      const errors = validateConfig({
        ...validConfig,
        nodeEnv: 'invalid' as 'development',
      });
      expect(errors).toContainEqual({
        field: 'nodeEnv',
        message: 'NODE_ENV must be one of: development, production, test',
      });
    });
  });
});

describe('validateUrl', () => {
  it('returns null for a valid URL', () => {
    expect(validateUrl('https://example.com', 'testField')).toBeNull();
  });

  it('returns error for an invalid URL', () => {
    const result = validateUrl('not-a-url', 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField is not a valid URL',
    });
  });

  it('returns error for an empty string', () => {
    const result = validateUrl('', 'testField');
    expect(result).not.toBeNull();
  });

  it('returns null for a valid URL with path', () => {
    expect(validateUrl('https://example.com/path/to/resource', 'testField')).toBeNull();
  });
});

describe('validateNumberRange', () => {
  it('returns null for a value within range', () => {
    expect(validateNumberRange(5, 0, 10, 'testField')).toBeNull();
  });

  it('returns null for a value at the minimum boundary', () => {
    expect(validateNumberRange(0, 0, 10, 'testField')).toBeNull();
  });

  it('returns null for a value at the maximum boundary', () => {
    expect(validateNumberRange(10, 0, 10, 'testField')).toBeNull();
  });

  it('returns error for a value below the minimum', () => {
    const result = validateNumberRange(-1, 0, 10, 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField must be between 0 and 10',
    });
  });

  it('returns error for a value above the maximum', () => {
    const result = validateNumberRange(11, 0, 10, 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField must be between 0 and 10',
    });
  });
});
