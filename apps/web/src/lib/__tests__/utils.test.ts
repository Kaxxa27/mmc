import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatRuntime,
  initials,
  plural,
  safeNext,
  toDateTimeLocal,
  toIsoDate,
} from '@/lib/utils';

describe('formatDate', () => {
  it('formats date-only values without shifting the day', () => {
    expect(formatDate('2026-11-05')).toBe('Nov 5, 2026');
    expect(formatDate('2026-01-01', { month: 'long', year: 'numeric' })).toBe('January 2026');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatRuntime', () => {
  it.each([
    [148, '2h 28m'],
    [120, '2h'],
    [45, '45m'],
    [null, ''],
    [0, ''],
  ])('%s minutes -> %s', (minutes, expected) => {
    expect(formatRuntime(minutes)).toBe(expected);
  });
});

describe('small helpers', () => {
  it('builds initials from one or two words', () => {
    expect(initials('Anna Smith')).toBe('AS');
    expect(initials('chloe')).toBe('C');
    expect(initials(null)).toBe('?');
  });

  it('pluralizes', () => {
    expect(plural(1, 'movie')).toBe('1 movie');
    expect(plural(3, 'movie')).toBe('3 movies');
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });

  it('formats local dates for date and datetime inputs', () => {
    expect(toIsoDate(new Date(2026, 0, 9))).toBe('2026-01-09');
    const local = new Date(2026, 10, 6, 19, 5);
    expect(toDateTimeLocal(local.toISOString())).toBe('2026-11-06T19:05');
    expect(toDateTimeLocal(null)).toBe('');
  });
});

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/groups/1?tab=members')).toBe('/groups/1?tab=members');
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '', null, undefined])(
    'rejects %s',
    (value) => {
      expect(safeNext(value)).toBe('/');
    },
  );
});
