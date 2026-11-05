/** Short, human-readable device description from a user agent string ("Chrome on macOS"). */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return 'an unknown device';
  const browser =
    [
      ['Edg/', 'Edge'],
      ['OPR/', 'Opera'],
      ['Firefox/', 'Firefox'],
      ['Chrome/', 'Chrome'],
      ['Safari/', 'Safari'],
    ].find(([token]) => userAgent.includes(token!))?.[1] ?? null;
  const os =
    [
      ['iPhone', 'iOS'],
      ['iPad', 'iPadOS'],
      ['Android', 'Android'],
      ['Mac OS X', 'macOS'],
      ['Windows', 'Windows'],
      ['Linux', 'Linux'],
    ].find(([token]) => userAgent.includes(token!))?.[1] ?? null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? userAgent.slice(0, 60);
}
