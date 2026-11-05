import { describe, expect, it } from 'vitest';
import { ApiError, buildQuery, errorMessage } from '@/lib/api/client';

describe('buildQuery', () => {
  it('skips empty values and joins arrays with commas', () => {
    expect(
      buildQuery({
        page: 2,
        status: ['want_to_watch', 'watching'],
        query: '',
        genre: undefined,
        favorite: true,
      }),
    ).toBe('?page=2&status=want_to_watch%2Cwatching&favorite=true');
  });

  it('returns an empty string when nothing is left', () => {
    expect(buildQuery()).toBe('');
    expect(buildQuery({ ids: [], q: null })).toBe('');
  });
});

describe('ApiError', () => {
  it('exposes rate-limit waits and validation messages', () => {
    const limited = new ApiError(429, 'OTP_RATE_LIMITED', 'Slow down', { retryAfterSeconds: 42 });
    expect(limited.retryAfterSeconds).toBe(42);
    const invalid = new ApiError(400, 'VALIDATION_FAILED', 'Invalid', [
      'email must be an email',
      'code is required',
    ]);
    expect(errorMessage(invalid)).toBe('email must be an email. code is required');
  });

  it('falls back to readable messages', () => {
    expect(errorMessage(new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found'))).toBe(
      'Group not found',
    );
    expect(errorMessage('weird')).toBe('Something went wrong.');
  });
});
