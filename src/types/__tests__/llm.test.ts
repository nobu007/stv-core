/**
 * Tests for LLM type guards
 */

import { isLLMModel } from '../llm';

describe('isLLMModel', () => {
  test('returns true for gemini-2.5-flash', () => {
    expect(isLLMModel('gemini-2.5-flash')).toBe(true);
  });

  test('returns true for gemini-2.5-pro', () => {
    expect(isLLMModel('gemini-2.5-pro')).toBe(true);
  });

  test('returns false for invalid string values', () => {
    expect(isLLMModel('gemini-2.0-flash')).toBe(false);
    expect(isLLMModel('gpt-4')).toBe(false);
    expect(isLLMModel('claude-3')).toBe(false);
    expect(isLLMModel('GEMINI-2.5-FLASH')).toBe(false);
    expect(isLLMModel('')).toBe(false);
  });

  test('returns false for non-string values', () => {
    expect(isLLMModel(123)).toBe(false);
    expect(isLLMModel(null)).toBe(false);
    expect(isLLMModel(undefined)).toBe(false);
    expect(isLLMModel({})).toBe(false);
    expect(isLLMModel([])).toBe(false);
    expect(isLLMModel(true)).toBe(false);
  });
});
