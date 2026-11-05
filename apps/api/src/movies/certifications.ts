import type { TmdbReleaseDates } from '../tmdb/tmdb.types.js';

/** Age-rating scales from least to most restrictive for common regions. */
export const CERTIFICATION_SCALES: Record<string, string[]> = {
  US: ['G', 'PG', 'PG-13', 'R', 'NC-17'],
  GB: ['U', 'PG', '12A', '12', '15', '18', 'R18'],
  DE: ['0', '6', '12', '16', '18'],
  FR: ['U', '10', '12', '16', '18'],
  CA: ['G', 'PG', '14A', '18A', 'R'],
  AU: ['G', 'PG', 'M', 'MA15+', 'R18+', 'X18+'],
  ES: ['A', '7', '12', '16', '18'],
  IT: ['T', '6+', '14+', '18+'],
  NL: ['AL', '6', '9', '12', '14', '16', '18'],
  BR: ['L', '10', '12', '14', '16', '18'],
  RU: ['0+', '6+', '12+', '16+', '18+'],
  UA: ['0+', '12+', '16+', '18+'],
  PL: ['0', '7', '12', '15', '16', '18'],
  JP: ['G', 'PG12', 'R15+', 'R18+'],
  KR: ['All', '12', '15', '18'],
};

/** Certifications allowed up to (and including) `max` in `country`, or null if unknown. */
export function certificationsUpTo(country: string, max: string): string[] | null {
  const scale = CERTIFICATION_SCALES[country.toUpperCase()];
  if (!scale) return null;
  const index = scale.indexOf(max);
  return index === -1 ? null : scale.slice(0, index + 1);
}

/** Picks one certification per country, preferring theatrical releases. */
export function extractCertifications(
  releaseDates: TmdbReleaseDates | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of releaseDates?.results ?? []) {
    const rated = entry.release_dates.filter((r) => r.certification.trim().length > 0);
    const preferred = rated.find((r) => r.type === 3) ?? rated[0];
    if (preferred) result[entry.iso_3166_1] = preferred.certification.trim();
  }
  return result;
}
