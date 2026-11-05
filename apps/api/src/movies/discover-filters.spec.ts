import { buildDiscoverParams, discoverCacheKey } from './discover-filters.js';

describe('buildDiscoverParams', () => {
  const today = '2026-11-04';

  it('maps filters to TMDB parameters', () => {
    const params = buildDiscoverParams(
      {
        genreIds: [35, 16],
        yearFrom: 1990,
        yearTo: 1999,
        minRating: 7,
        maxRuntime: 120,
        maxCertification: 'PG',
        castIds: [31],
        sort: 'newest',
      },
      today,
    );
    expect(params).toMatchObject({
      sort_by: 'primary_release_date.desc',
      with_genres: '35|16',
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
      'vote_average.gte': 7,
      'with_runtime.lte': 120,
      certification_country: 'US',
      'certification.lte': 'PG',
      with_cast: '31',
      include_adult: false,
    });
  });

  it('requires every genre when genreMatch is all', () => {
    expect(buildDiscoverParams({ genreIds: [28, 12], genreMatch: 'all' }, today).with_genres).toBe(
      '28,12',
    );
  });

  it('adds a minimum vote count when sorting by rating', () => {
    expect(buildDiscoverParams({ sort: 'rating' }, today)['vote_count.gte']).toBe(200);
    expect(buildDiscoverParams({ sort: 'rating', minVotes: 10 }, today)['vote_count.gte']).toBe(10);
  });

  it('limits released / upcoming movies by date', () => {
    expect(
      buildDiscoverParams({ releaseState: 'released' }, today)['primary_release_date.lte'],
    ).toBe(today);
    expect(
      buildDiscoverParams({ releaseState: 'upcoming', yearFrom: 2020 }, today)[
        'primary_release_date.gte'
      ],
    ).toBe(today);
  });

  it('builds the same cache key regardless of property order', () => {
    expect(discoverCacheKey({ b: 1, a: 'x', c: undefined })).toBe(
      discoverCacheKey({ a: 'x', b: 1 }),
    );
  });
});
