/**
 * Tests for pipeline type guards
 */

import { isProcessingStatus } from '../pipeline';

describe('isProcessingStatus', () => {
  const validStatuses: string[] = [
    'idle',
    'uploading',
    'transcribing',
    'analyzing',
    'generating',
    'complete',
    'error',
  ];

  test.each(validStatuses)('returns true for valid ProcessingStatus: %s', (value) => {
    expect(isProcessingStatus(value)).toBe(true);
  });

  test('returns false for invalid string values', () => {
    expect(isProcessingStatus('pending')).toBe(false);
    expect(isProcessingStatus('running')).toBe(false);
    expect(isProcessingStatus('COMPLETE')).toBe(false);
    expect(isProcessingStatus('')).toBe(false);
  });

  test('returns false for non-string values', () => {
    expect(isProcessingStatus(123)).toBe(false);
    expect(isProcessingStatus(null)).toBe(false);
    expect(isProcessingStatus(undefined)).toBe(false);
    expect(isProcessingStatus({})).toBe(false);
    expect(isProcessingStatus([])).toBe(false);
    expect(isProcessingStatus(true)).toBe(false);
  });
});
