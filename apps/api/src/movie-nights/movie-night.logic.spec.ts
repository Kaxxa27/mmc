import {
  decideWinner,
  matchesCriteria,
  pickRandom,
  rankSuggestions,
  type SuggestionInput,
  tallyVotes,
} from './movie-night.logic.js';

const movie = (overrides: Partial<SuggestionInput>): SuggestionInput => ({
  movieId: overrides.tmdbId ? `m${overrides.tmdbId}` : 'm',
  tmdbId: 1,
  title: 'Movie',
  genreIds: [35],
  voteAverage: 7.5,
  runtime: 100,
  certifications: { US: 'PG' },
  inGroupWatchlist: true,
  wantedBy: 0,
  watchedBy: 0,
  ...overrides,
});

describe('movie night shortlist', () => {
  it('applies genre, rating, runtime and age criteria', () => {
    const criteria = { genreIds: [35, 16], minRating: 7, maxRuntime: 120, maxCertification: 'PG' };
    expect(matchesCriteria(movie({}), criteria, 3)).toBe(true);
    expect(matchesCriteria(movie({ genreIds: [27] }), criteria, 3)).toBe(false);
    expect(matchesCriteria(movie({ voteAverage: 6.9 }), criteria, 3)).toBe(false);
    expect(matchesCriteria(movie({ runtime: 150 }), criteria, 3)).toBe(false);
    expect(matchesCriteria(movie({ runtime: null }), criteria, 3)).toBe(false);
    expect(matchesCriteria(movie({ certifications: { US: 'PG-13' } }), criteria, 3)).toBe(false);
    expect(matchesCriteria(movie({ certifications: {} }), criteria, 3)).toBe(false);
  });

  it('excludes movies everyone (default) or anyone has already watched', () => {
    expect(matchesCriteria(movie({ watchedBy: 3 }), {}, 3)).toBe(false);
    expect(matchesCriteria(movie({ watchedBy: 2 }), {}, 3)).toBe(true);
    expect(matchesCriteria(movie({ watchedBy: 1 }), { excludeWatchedBy: 'any' }, 3)).toBe(false);
    expect(matchesCriteria(movie({ watchedBy: 3 }), { excludeWatchedBy: 'none' }, 3)).toBe(true);
  });

  it('ranks movies that more participants want to see first', () => {
    const ranked = rankSuggestions(
      [
        movie({ tmdbId: 1, title: 'Liked by one', wantedBy: 1, voteAverage: 9 }),
        movie({ tmdbId: 2, title: 'Liked by all', wantedBy: 3, voteAverage: 7 }),
        movie({ tmdbId: 3, title: 'Not on group list', inGroupWatchlist: false, voteAverage: 8 }),
      ],
      {},
      3,
    );
    expect(ranked.map((m) => m.tmdbId)).toEqual([2, 1, 3]);
    expect(ranked[0]!.reasons).toContain('3 of 3 want to watch it');
  });
});

describe('voting', () => {
  it('tallies votes per candidate, including zero-vote candidates', () => {
    expect(
      tallyVotes(
        ['a', 'b', 'c'],
        [{ movieId: 'b' }, { movieId: 'b' }, { movieId: 'a' }, { movieId: 'x' }],
      ),
    ).toEqual([
      { movieId: 'b', votes: 2 },
      { movieId: 'a', votes: 1 },
      { movieId: 'c', votes: 0 },
    ]);
  });

  it('picks the most voted movie', () => {
    expect(
      decideWinner([
        { movieId: 'a', votes: 3 },
        { movieId: 'b', votes: 1 },
      ]),
    ).toEqual({ movieId: 'a', tied: false });
  });

  it('breaks ties with the organiser choice or randomly', () => {
    const tie = [
      { movieId: 'a', votes: 2 },
      { movieId: 'b', votes: 2 },
      { movieId: 'c', votes: 1 },
    ];
    expect(decideWinner(tie, 'b')).toEqual({ movieId: 'b', tied: true });
    expect(decideWinner(tie, 'c', () => 0)).toEqual({ movieId: 'a', tied: true });
    expect(decideWinner(tie, undefined, () => 0.99)).toEqual({ movieId: 'b', tied: true });
  });

  it('returns null when nobody voted', () => {
    expect(decideWinner([{ movieId: 'a', votes: 0 }])).toBeNull();
    expect(decideWinner([])).toBeNull();
  });

  it('picks randomly from a list', () => {
    expect(pickRandom(['x', 'y', 'z'], () => 0.5)).toBe('y');
    expect(pickRandom([])).toBeUndefined();
  });
});
