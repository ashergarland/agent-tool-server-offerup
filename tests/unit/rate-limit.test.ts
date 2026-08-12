import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from '../../src/server/rate-limit.js';

describe('rate limiter', () => {
  it('limits within a window and resets deterministically', () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000);
    expect(limiter.consume('caller', 0).allowed).toBe(true);
    expect(limiter.consume('caller', 1).allowed).toBe(false);
    expect(limiter.consume('caller', 1_000).allowed).toBe(true);
  });

  it('supports an explicitly unlimited local mode', () => {
    expect(new FixedWindowRateLimiter(0, 1_000).consume('caller', 0).allowed).toBe(true);
  });
});
