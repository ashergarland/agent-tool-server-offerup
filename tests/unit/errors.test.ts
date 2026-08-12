import { describe, expect, it } from 'vitest';
import { AppError, badRequest, toAppError } from '../../src/errors.js';

describe('public error mapping', () => {
  it('preserves application errors and safely wraps unknown failures', () => {
    const expected = badRequest('invalid', { field: 'value' });
    expect(toAppError(expected)).toBe(expected);
    const mapped = toAppError(new Error('secret internal detail'));
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped).toMatchObject({
      code: 'internal_error',
      message: 'The tool server failed to complete the request',
      statusCode: 500,
    });
  });
});
