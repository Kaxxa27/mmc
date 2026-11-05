import { type NextRequest, NextResponse } from 'next/server';
import { hintCookieOptions, REFRESH_COOKIE } from '@/lib/session';
import { SESSION_HINT_COOKIE } from '@/lib/session-hint';

/** Pages that need a signed-in user. The API enforces access; this only avoids empty screens. */
const PROTECTED_PREFIXES = [
  '/my-movies',
  '/watchlist',
  '/history',
  '/stats',
  '/calendar',
  '/groups',
  '/movie-nights',
  '/notifications',
  '/settings',
  '/onboarding',
  '/reviews',
];

function isProtected(pathname: string): boolean {
  // Collections can be public, so only the list of your own collections is protected.
  if (pathname === '/collections') return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_COOKIE);
  let response: NextResponse;
  if (isProtected(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next();
  }
  // Keep the readable "signed in" hint in sync with the httpOnly session cookie.
  const hasHint = request.cookies.has(SESSION_HINT_COOKIE);
  if (hasSession && !hasHint) response.cookies.set(SESSION_HINT_COOKIE, '1', hintCookieOptions());
  if (!hasSession && hasHint) response.cookies.delete(SESSION_HINT_COOKIE);
  return response;
}

export const config = {
  matcher: ['/((?!_next/|bff/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)'],
};
