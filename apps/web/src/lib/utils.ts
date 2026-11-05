import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const LOCALE = 'en-US';

/** `2026-11-05` or an ISO timestamp -> `Nov 5, 2026`. Date-only values are not shifted by time zones. */
export function formatDate(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(
    LOCALE,
    options ?? { year: 'numeric', month: 'short', day: 'numeric' },
  ).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 148 -> `2h 28m` */
export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}

export function formatRelative(value: string, now = Date.now()): string {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** `YYYY-MM-DD` in local time. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function initials(name: string | null | undefined): string {
  return (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Value for an `<input type="datetime-local">` from an ISO timestamp (local time). */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${toIsoDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Only same-site relative paths are allowed as redirect targets (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback;
  return next;
}
