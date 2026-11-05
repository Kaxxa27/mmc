/** Session cookies shared by the BFF route handler and `proxy.ts` (server-side only). */
export const ACCESS_COOKIE = 'mmc_at';
export const REFRESH_COOKIE = 'mmc_rt';
/** Matches the API's session lifetime (Supabase `auth.sessions.timebox`, 30 days). */
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Unix time (seconds) when the access token expires. */
  expiresAt: number;
}

/** Options for the readable session hint cookie (see `session-hint.ts`). */
export function hintCookieOptions() {
  return { ...cookieOptions(REFRESH_MAX_AGE_SECONDS), httpOnly: false };
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

/** Expiry (Unix seconds) read from a JWT without verifying it (the API verifies tokens). */
export function tokenExpiry(token: string | undefined): number | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const { exp } = JSON.parse(atob(base64)) as { exp?: unknown };
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** True when the access token is missing or expires within `marginSeconds`. */
export function needsRefresh(
  accessToken: string | undefined,
  marginSeconds = 60,
  now = Date.now(),
): boolean {
  const exp = tokenExpiry(accessToken);
  return exp === null || exp * 1000 - now < marginSeconds * 1000;
}
