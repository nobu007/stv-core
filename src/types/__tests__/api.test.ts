/**
 * Tests for API types
 */

import type { ApiResponse, ApiError } from '../api';

describe('ApiResponse type', () => {
  test('can create a success response', () => {
    const response: ApiResponse<string> = {
      success: true,
      data: 'test data',
    };
    expect(response.success).toBe(true);
    expect(response.data).toBe('test data');
    expect(response.error).toBeUndefined();
  });

  test('can create an error response', () => {
    const error: ApiError = {
      code: 'ERR_001',
      message: 'Something went wrong',
    };
    const response: ApiResponse<string> = {
      success: false,
      error,
    };
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe('ERR_001');
    expect(response.error?.message).toBe('Something went wrong');
    expect(response.data).toBeUndefined();
  });

  test('can create an error response with details', () => {
    const error: ApiError = {
      code: 'ERR_002',
      message: 'Validation failed',
      details: { field: 'email', reason: 'invalid format' },
    };
    const response: ApiResponse<unknown> = {
      success: false,
      error,
    };
    expect(response.error?.details).toEqual({ field: 'email', reason: 'invalid format' });
  });

  test('ApiError can be constructed without optional details', () => {
    const error: ApiError = {
      code: 'ERR_003',
      message: 'Not found',
    };
    expect(error.code).toBe('ERR_003');
    expect(error.message).toBe('Not found');
    expect(error.details).toBeUndefined();
  });
});
