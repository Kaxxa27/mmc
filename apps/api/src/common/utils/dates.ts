/** Today's date as `YYYY-MM-DD` (UTC). */
export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Year part of a `YYYY-MM-DD` string, or null. */
export function yearOf(isoDate: string | null | undefined): number | null {
  if (!isoDate || isoDate.length < 4) return null;
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}
