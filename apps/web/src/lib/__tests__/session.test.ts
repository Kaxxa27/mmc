import { describe, expect, it } from 'vitest';
import { cookieOptions, needsRefresh, tokenExpiry } from '@/lib/session';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('tokenExpiry', () => {
  it('reads exp from the payload', () => {
    expect(tokenExpiry(jwt({ exp: 1_800_000_000 }))).toBe(1_800_000_000);
  });

  it('returns null for malformed tokens', () => {
    expect(tokenExpiry('nope')).toBeNull();
    expect(tokenExpiry(jwt({ sub: 'user' }))).toBeNull();
  });
});

describe('needsRefresh', () => {
  const now = Math.floor(Date.now() / 1000);

  it('refreshes when the token is missing, broken or about to expire', () => {
    expect(needsRefresh(undefined)).toBe(true);
    expect(needsRefresh('broken')).toBe(true);
    expect(needsRefresh(jwt({ exp: now + 30 }))).toBe(true);
  });

  it('keeps a token that is valid for longer than the margin', () => {
    expect(needsRefresh(jwt({ exp: now + 600 }))).toBe(false);
  });
});

describe('cookieOptions', () => {
  it('uses httpOnly, lax, root-path cookies', () => {
    expect(cookieOptions(60)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
  });
});
