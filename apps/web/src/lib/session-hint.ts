/**
 * A readable (non-httpOnly) cookie that only says "a session exists". The tokens stay in
 * httpOnly cookies; the hint lets the browser skip `/me` requests for guests.
 */
export const SESSION_HINT_COOKIE = 'mmc_signed_in';

export function hasSessionHint(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.cookie.split('; ').some((part) => part === `${SESSION_HINT_COOKIE}=1`)
  );
}
