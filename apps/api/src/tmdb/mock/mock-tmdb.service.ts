import { Injectable } from '@nestjs/common';
import { addDays, todayIsoDate } from '../../common/utils/dates.js';
import { AppConfig } from '../../config/app-config.js';
import { CERTIFICATION_SCALES } from '../../movies/certifications.js';
import { TmdbNotFoundError, type TmdbParams } from '../tmdb.errors.js';
import {
  MOCK_MOVIES,
  type MockMovieSeed,
  type MockStream,
  type UsCertification,
} from './mock-movies.js';
import { MOCK_PEOPLE, type MockPersonSeed } from './mock-people.js';

const PAGE_SIZE = 20;

const GENRE_ORDER = [
  28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37,
];

const GENRES: Record<number, [english: string, russian: string]> = {
  28: ['Action', 'Боевик'],
  12: ['Adventure', 'Приключения'],
  16: ['Animation', 'Мультфильм'],
  35: ['Comedy', 'Комедия'],
  80: ['Crime', 'Криминал'],
  99: ['Documentary', 'Документальный'],
  18: ['Drama', 'Драма'],
  10751: ['Family', 'Семейный'],
  14: ['Fantasy', 'Фэнтези'],
  36: ['History', 'История'],
  27: ['Horror', 'Ужасы'],
  10402: ['Music', 'Музыка'],
  9648: ['Mystery', 'Детектив'],
  10749: ['Romance', 'Мелодрама'],
  878: ['Science Fiction', 'Фантастика'],
  10770: ['TV Movie', 'Телевизионный фильм'],
  53: ['Thriller', 'Триллер'],
  10752: ['War', 'Военный'],
  37: ['Western', 'Вестерн'],
};

const COUNTRY_NAMES: Record<string, string> = {
  CA: 'Canada',
  CZ: 'Czech Republic',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  NG: 'Nigeria',
  NO: 'Norway',
  NZ: 'New Zealand',
  SE: 'Sweden',
  US: 'United States of America',
};

const LANGUAGE_NAMES: Record<string, [english: string, native: string]> = {
  de: ['German', 'Deutsch'],
  en: ['English', 'English'],
  es: ['Spanish', 'Español'],
  fr: ['French', 'Français'],
  it: ['Italian', 'Italiano'],
  ja: ['Japanese', '日本語'],
  ko: ['Korean', '한국어/조선말'],
  sv: ['Swedish', 'svenska'],
  zh: ['Mandarin', '普通话'],
};

type ProviderKey = MockStream | 'apple' | 'google' | 'amazon';

export const MOCK_PROVIDERS: Record<ProviderKey, { id: number; name: string }> = {
  netflix: { id: 8, name: 'Netflix' },
  disney: { id: 337, name: 'Disney Plus' },
  max: { id: 1899, name: 'Max' },
  prime: { id: 9, name: 'Amazon Prime Video' },
  hulu: { id: 15, name: 'Hulu' },
  apple: { id: 2, name: 'Apple TV' },
  google: { id: 3, name: 'Google Play Movies' },
  amazon: { id: 10, name: 'Amazon Video' },
};

const PROVIDER_REGIONS = ['US', 'GB', 'DE'];
const RELEASE_REGIONS = ['US', 'GB', 'DE', 'RU'];

/** Age ratings for other regions, derived from the US rating (good enough for mock data). */
const CERTIFICATION_BY_REGION: Record<string, Record<UsCertification, string>> = {
  US: { G: 'G', PG: 'PG', 'PG-13': 'PG-13', R: 'R' },
  GB: { G: 'U', PG: 'PG', 'PG-13': '12A', R: '15' },
  DE: { G: '0', PG: '6', 'PG-13': '12', R: '16' },
  RU: { G: '0+', PG: '6+', 'PG-13': '12+', R: '18+' },
};

interface PersonRecord extends MockPersonSeed {
  id: number;
}

interface Credit {
  movieId: number;
  character?: string;
  job?: string;
  order: number;
}

/** Lower-case, accent-free text for matching ("Amélie" and "amelie", "ё" and "е" match). */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const department = (job: string): string =>
  job === 'Director'
    ? 'Directing'
    : job === 'Original Music Composer'
      ? 'Sound'
      : job === 'Producer'
        ? 'Production'
        : 'Writing';

/**
 * A stand-in for the TMDB v3 API used when no TMDB key is available (TMDB_MODE=mock).
 * It answers the same endpoints with responses shaped exactly like TMDB's, so the whole app
 * (lists, search, filters, details, people, caching) can be exercised without network access.
 */
@Injectable()
export class MockTmdbService {
  private readonly movies = new Map<number, MockMovieSeed>();
  private readonly people = new Map<number, PersonRecord>();
  private readonly credits = new Map<number, Credit[]>();
  private readonly castIds = new Map<number, number[]>();
  private readonly crewIds = new Map<number, number[]>();

  constructor(private readonly config: AppConfig) {
    const bySlug = new Map(MOCK_PEOPLE.map((person) => [person.slug, person]));
    const resolve = (slug: string, movieId: number): PersonRecord => {
      const person = bySlug.get(slug);
      if (!person) throw new Error(`Mock movie ${movieId} references unknown person "${slug}"`);
      return person;
    };
    for (const person of MOCK_PEOPLE) {
      this.people.set(person.id, person);
      this.credits.set(person.id, []);
    }
    for (const movie of MOCK_MOVIES) {
      this.movies.set(movie.id, movie);
      this.castIds.set(
        movie.id,
        movie.cast.map(([slug, character], order) => {
          const person = resolve(slug, movie.id);
          this.credits.get(person.id)!.push({ movieId: movie.id, character, order });
          return person.id;
        }),
      );
      this.crewIds.set(
        movie.id,
        movie.crew.map(([slug, job], order) => {
          const person = resolve(slug, movie.id);
          this.credits.get(person.id)!.push({ movieId: movie.id, job, order });
          return person.id;
        }),
      );
    }
  }

  async get<T>(path: string, params: TmdbParams = {}): Promise<T> {
    if (this.config.tmdb.mockLatencyMs > 0) await sleep(this.config.tmdb.mockLatencyMs);
    return this.route(path, params, new Date()) as T;
  }

  /** Label for the generated placeholder images (`/mock/<kind>/<id>.svg`). */
  describeImage(
    kind: string,
    id: number,
  ): { label: string; sublabel: string | null; seed: number } {
    if (kind === 'poster' || kind === 'backdrop') {
      const movie = this.movies.get(id);
      if (movie)
        return {
          label: movie.title,
          sublabel: this.releaseDate(movie, new Date()).slice(0, 4),
          seed: id,
        };
    }
    if (kind === 'profile') {
      const person = this.people.get(id);
      if (person) return { label: person.name, sublabel: person.department, seed: id };
    }
    if (kind === 'logo') {
      const provider = Object.values(MOCK_PROVIDERS).find((p) => p.id === id);
      if (provider) return { label: provider.name, sublabel: null, seed: id };
    }
    return { label: `#${id}`, sublabel: null, seed: id };
  }

  private route(path: string, params: TmdbParams, now: Date): unknown {
    const language = String(params.language ?? this.config.tmdb.defaultLanguage);
    const today = todayIsoDate(now);
    const all = [...this.movies.values()];
    const released = all.filter((movie) => this.releaseDate(movie, now) <= today);
    const byPopularity = (a: MockMovieSeed, b: MockMovieSeed) => b.popularity - a.popularity;
    let match: RegExpExecArray | null;

    switch (path) {
      case '/configuration':
        return this.configuration();
      case '/genre/movie/list':
        return { genres: GENRE_ORDER.map((id) => this.genre(id, language)) };
      case '/movie/popular':
        return this.page(released.sort(byPopularity), params, now);
      case '/movie/top_rated':
        return this.page(
          released
            .filter((movie) => movie.vote[1] >= 1000)
            .sort((a, b) => b.vote[0] - a.vote[0] || b.vote[1] - a.vote[1]),
          params,
          now,
        );
      case '/movie/upcoming':
        return {
          dates: { minimum: today, maximum: todayIsoDate(addDays(now, 180)) },
          ...this.page(
            all
              .filter((movie) => this.releaseDate(movie, now) > today)
              .sort((a, b) => this.releaseDate(a, now).localeCompare(this.releaseDate(b, now))),
            params,
            now,
          ),
        };
      case '/movie/now_playing': {
        const from = todayIsoDate(addDays(now, -60));
        return {
          dates: { minimum: from, maximum: today },
          ...this.page(
            released.filter((movie) => this.releaseDate(movie, now) >= from).sort(byPopularity),
            params,
            now,
          ),
        };
      }
      case '/search/movie':
        return this.page(this.searchMovies(params, now), params, now);
      case '/search/person':
        return this.searchPeople(params, now);
      case '/discover/movie':
        return this.page(this.discover(params, now), params, now);
    }

    if ((match = /^\/trending\/movie\/(day|week)$/.exec(path))) {
      return this.page(this.trending(match[1] as 'day' | 'week', now), params, now);
    }
    if ((match = /^\/movie\/(\d+)\/similar$/.exec(path))) {
      return this.page(this.similarTo(this.movie(Number(match[1]))), params, now);
    }
    if ((match = /^\/movie\/(\d+)$/.exec(path))) {
      return this.details(this.movie(Number(match[1])), params, now);
    }
    if ((match = /^\/person\/(\d+)$/.exec(path))) {
      return this.personDetails(Number(match[1]), params, now);
    }
    throw new TmdbNotFoundError(`The mock TMDB API does not provide ${path}`);
  }

  private movie(id: number): MockMovieSeed {
    const movie = this.movies.get(id);
    if (!movie) throw new TmdbNotFoundError(`Mock movie ${id} not found`);
    return movie;
  }

  private releaseDate(movie: MockMovieSeed, now: Date): string {
    return typeof movie.release === 'string'
      ? movie.release
      : todayIsoDate(addDays(now, movie.release));
  }

  private isRussian(params: TmdbParams): boolean {
    return String(params.language ?? '')
      .toLowerCase()
      .startsWith('ru');
  }

  private text(movie: MockMovieSeed, params: TmdbParams): { title: string; overview: string } {
    const suffix = movie.fictional
      ? this.isRussian(params)
        ? ' (Вымышленный фильм из тестовых данных.)'
        : ' (Fictional movie from the mock dataset.)'
      : '';
    const [title, overview] = this.isRussian(params) ? movie.ru : [movie.title, movie.overview];
    return { title, overview: `${overview}${suffix}` };
  }

  private genre(id: number, language: string): { id: number; name: string } {
    const names = GENRES[id] ?? [`Genre ${id}`, `Жанр ${id}`];
    return { id, name: language.toLowerCase().startsWith('ru') ? names[1] : names[0] };
  }

  private listItem(movie: MockMovieSeed, params: TmdbParams, now: Date) {
    const { title, overview } = this.text(movie, params);
    return {
      adult: false,
      backdrop_path: `/mock/backdrop/${movie.id}.svg`,
      genre_ids: movie.genres,
      id: movie.id,
      original_language: movie.language,
      original_title: movie.originalTitle ?? movie.title,
      overview,
      popularity: movie.popularity,
      poster_path: `/mock/poster/${movie.id}.svg`,
      release_date: this.releaseDate(movie, now),
      title,
      video: false,
      vote_average: movie.vote[0],
      vote_count: movie.vote[1],
    };
  }

  private page(movies: MockMovieSeed[], params: TmdbParams, now: Date) {
    const page = Math.max(1, Number(params.page ?? 1) || 1);
    return {
      page,
      results: movies
        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        .map((m) => this.listItem(m, params, now)),
      total_pages: Math.max(1, Math.ceil(movies.length / PAGE_SIZE)),
      total_results: movies.length,
    };
  }

  private configuration() {
    const base = `${this.config.tmdb.imageBaseUrl}/`;
    return {
      images: {
        base_url: base,
        secure_base_url: base,
        backdrop_sizes: ['w300', 'w780', 'w1280', 'original'],
        logo_sizes: ['w45', 'w92', 'w154', 'w185', 'w300', 'w500', 'original'],
        poster_sizes: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
        profile_sizes: ['w45', 'w185', 'h632', 'original'],
        still_sizes: ['w92', 'w185', 'w300', 'original'],
      },
      change_keys: [],
    };
  }

  private trending(window: 'day' | 'week', now: Date): MockMovieSeed[] {
    const today = todayIsoDate(now);
    const soon = todayIsoDate(addDays(now, 30));
    const recent = todayIsoDate(addDays(now, -60));
    const dayOfYear = Math.floor(now.getTime() / 86_400_000);
    const score = (movie: MockMovieSeed) => {
      const date = this.releaseDate(movie, now);
      const boost = date >= recent && date <= today ? 2.5 : date > today && date <= soon ? 1.5 : 1;
      // The daily list varies a little from one day to the next.
      const daily = window === 'day' ? 0.8 + ((movie.id * 31 + dayOfYear * 17) % 41) / 100 : 1;
      return movie.popularity * boost * daily;
    };
    return [...this.movies.values()]
      .filter((movie) => this.releaseDate(movie, now) <= soon)
      .sort((a, b) => score(b) - score(a));
  }

  private searchMovies(params: TmdbParams, now: Date): MockMovieSeed[] {
    const query = normalizeText(String(params.query ?? ''));
    if (!query) return [];
    const year = Number(params.primary_release_year ?? params.year ?? 0);
    const rank = (movie: MockMovieSeed): number => {
      const names = [
        movie.title,
        movie.originalTitle ?? '',
        movie.ru[0],
        ...(movie.alternativeTitles ?? []).map(([, title]) => title),
      ].map(normalizeText);
      if (names.some((name) => name === query)) return 3;
      if (names.some((name) => name.startsWith(query))) return 2;
      if (names.some((name) => name.includes(query))) return 1;
      return 0;
    };
    return [...this.movies.values()]
      .filter((movie) => !year || this.releaseDate(movie, now).startsWith(String(year)))
      .map((movie) => ({ movie, score: rank(movie) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.movie.popularity - a.movie.popularity)
      .map((entry) => entry.movie);
  }

  private searchPeople(params: TmdbParams, now: Date) {
    const query = normalizeText(String(params.query ?? ''));
    const matches = query
      ? [...this.people.values()]
          .filter((person) => normalizeText(person.name).includes(query))
          .sort((a, b) => this.personPopularity(b.id) - this.personPopularity(a.id))
      : [];
    const page = Math.max(1, Number(params.page ?? 1) || 1);
    return {
      page,
      results: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((person) => ({
        adult: false,
        gender: 0,
        id: person.id,
        known_for_department: person.department,
        name: person.name,
        original_name: person.name,
        popularity: this.personPopularity(person.id),
        profile_path: `/mock/profile/${person.id}.svg`,
        known_for: this.knownFor(person.id)
          .slice(0, 3)
          .map((movie) => ({ ...this.listItem(movie, params, now), media_type: 'movie' })),
      })),
      total_pages: Math.max(1, Math.ceil(matches.length / PAGE_SIZE)),
      total_results: matches.length,
    };
  }

  /** `/discover/movie` with the TMDB parameter names the API sends. */
  private discover(params: TmdbParams, now: Date): MockMovieSeed[] {
    const value = (name: string) => {
      const raw = params[name];
      return raw === undefined || raw === null || raw === '' ? undefined : String(raw);
    };
    const number = (name: string) => (value(name) === undefined ? undefined : Number(value(name)));
    const idList = (name: string) => {
      const raw = value(name);
      if (!raw) return undefined;
      return { any: raw.includes('|'), ids: raw.split(/[|,]/).map(Number).filter(Number.isFinite) };
    };
    const matchesIds = (list: { any: boolean; ids: number[] } | undefined, available: number[]) =>
      !list ||
      (list.any
        ? list.ids.some((id) => available.includes(id))
        : list.ids.every((id) => available.includes(id)));

    const genres = idList('with_genres');
    const cast = idList('with_cast');
    const crew = idList('with_crew');
    const dateFrom = value('primary_release_date.gte');
    const dateTo = value('primary_release_date.lte');
    const language = value('with_original_language');
    const country = value('with_origin_country');
    const minRating = number('vote_average.gte');
    const maxRating = number('vote_average.lte');
    const minVotes = number('vote_count.gte');
    const minRuntime = number('with_runtime.gte');
    const maxRuntime = number('with_runtime.lte');
    const certificationCountry = (value('certification_country') ?? 'US').toUpperCase();
    const maxCertification = value('certification.lte');
    const scale = CERTIFICATION_SCALES[certificationCountry];
    const allowed =
      maxCertification && scale ? scale.slice(0, scale.indexOf(maxCertification) + 1) : undefined;

    const results = [...this.movies.values()].filter((movie) => {
      const date = this.releaseDate(movie, now);
      return (
        matchesIds(genres, movie.genres) &&
        matchesIds(cast, this.castIds.get(movie.id) ?? []) &&
        matchesIds(crew, this.crewIds.get(movie.id) ?? []) &&
        (!dateFrom || date >= dateFrom) &&
        (!dateTo || date <= dateTo) &&
        (!language || movie.language === language) &&
        (!country || movie.countries.includes(country)) &&
        (minRating === undefined || movie.vote[0] >= minRating) &&
        (maxRating === undefined || movie.vote[0] <= maxRating) &&
        (minVotes === undefined || movie.vote[1] >= minVotes) &&
        (minRuntime === undefined || movie.runtime >= minRuntime) &&
        (maxRuntime === undefined || movie.runtime <= maxRuntime) &&
        (!allowed || allowed.includes(this.certification(movie, certificationCountry)))
      );
    });

    const sorters: Record<string, (a: MockMovieSeed, b: MockMovieSeed) => number> = {
      'popularity.desc': (a, b) => b.popularity - a.popularity,
      'vote_average.desc': (a, b) => b.vote[0] - a.vote[0] || b.vote[1] - a.vote[1],
      'primary_release_date.desc': (a, b) =>
        this.releaseDate(b, now).localeCompare(this.releaseDate(a, now)),
      'primary_release_date.asc': (a, b) =>
        this.releaseDate(a, now).localeCompare(this.releaseDate(b, now)),
      'title.asc': (a, b) => a.title.localeCompare(b.title),
    };
    return results.sort(
      sorters[value('sort_by') ?? 'popularity.desc'] ?? sorters['popularity.desc'],
    );
  }

  private certification(movie: MockMovieSeed, region: string): string {
    return CERTIFICATION_BY_REGION[region]?.[movie.certification] ?? '';
  }

  private details(movie: MockMovieSeed, params: TmdbParams, now: Date) {
    const append = new Set(
      String(params.append_to_response ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    );
    const language = String(params.language ?? this.config.tmdb.defaultLanguage);
    const date = this.releaseDate(movie, now);
    const released = date <= todayIsoDate(now);
    const { title, overview } = this.text(movie, params);

    const details: Record<string, unknown> = {
      adult: false,
      backdrop_path: `/mock/backdrop/${movie.id}.svg`,
      belongs_to_collection: null,
      budget: 0,
      genres: movie.genres.map((id) => this.genre(id, language)),
      homepage: '',
      id: movie.id,
      imdb_id: null,
      origin_country: movie.countries,
      original_language: movie.language,
      original_title: movie.originalTitle ?? movie.title,
      overview,
      popularity: movie.popularity,
      poster_path: `/mock/poster/${movie.id}.svg`,
      production_companies: [],
      production_countries: movie.countries.map((code) => ({
        iso_3166_1: code,
        name: COUNTRY_NAMES[code] ?? code,
      })),
      release_date: date,
      revenue: 0,
      runtime: movie.runtime,
      spoken_languages: movie.spokenLanguages.map((code) => ({
        english_name: LANGUAGE_NAMES[code]?.[0] ?? code,
        iso_639_1: code,
        name: LANGUAGE_NAMES[code]?.[1] ?? code,
      })),
      status: released ? 'Released' : 'Post Production',
      tagline: '',
      title,
      video: false,
      vote_average: movie.vote[0],
      vote_count: movie.vote[1],
    };

    if (append.has('credits')) details.credits = this.movieCredits(movie);
    if (append.has('videos')) details.videos = { results: this.videos(movie, date) };
    if (append.has('release_dates')) {
      details.release_dates = {
        results: RELEASE_REGIONS.map((region) => ({
          iso_3166_1: region,
          release_dates: [
            {
              certification: this.certification(movie, region),
              descriptors: [],
              iso_639_1: '',
              note: '',
              release_date: `${date}T00:00:00.000Z`,
              type: 3,
            },
          ],
        })),
      };
    }
    if (append.has('similar')) details.similar = this.page(this.similarTo(movie), {}, now);
    if (append.has('recommendations'))
      details.recommendations = this.page(this.recommendationsFor(movie), {}, now);
    if (append.has('watch/providers')) {
      details['watch/providers'] = {
        results: released && !movie.fictional ? this.providers(movie) : {},
      };
    }
    if (append.has('alternative_titles')) {
      details.alternative_titles = {
        id: movie.id,
        titles: [...(movie.alternativeTitles ?? []), ['RU', movie.ru[0]] as [string, string]].map(
          ([country, alternative]) => ({ iso_3166_1: country, title: alternative, type: '' }),
        ),
      };
    }
    return details;
  }

  private movieCredits(movie: MockMovieSeed) {
    const people = (ids: number[]) => ids.map((id) => this.people.get(id)!);
    return {
      id: movie.id,
      cast: people(this.castIds.get(movie.id) ?? []).map((person, order) => ({
        adult: false,
        cast_id: order + 1,
        character: movie.cast[order]![1],
        credit_id: `mock-${movie.id}-cast-${order}`,
        gender: 0,
        id: person.id,
        known_for_department: person.department,
        name: person.name,
        order,
        original_name: person.name,
        popularity: this.personPopularity(person.id),
        profile_path: `/mock/profile/${person.id}.svg`,
      })),
      crew: people(this.crewIds.get(movie.id) ?? []).map((person, index) => {
        const job = movie.crew[index]![1];
        return {
          adult: false,
          credit_id: `mock-${movie.id}-crew-${index}`,
          department: department(job),
          gender: 0,
          id: person.id,
          job,
          known_for_department: person.department,
          name: person.name,
          original_name: person.name,
          popularity: this.personPopularity(person.id),
          profile_path: `/mock/profile/${person.id}.svg`,
        };
      }),
    };
  }

  /** Placeholder trailer entries: the keys are not real YouTube videos. */
  private videos(movie: MockMovieSeed, releaseDate: string) {
    const published = `${todayIsoDate(addDays(new Date(`${releaseDate}T12:00:00Z`), -60))}T12:00:00.000Z`;
    return [
      { name: 'Official Trailer (mock)', key: `mock-${movie.id}-trailer`, type: 'Trailer' },
      { name: 'Teaser (mock)', key: `mock-${movie.id}-teaser`, type: 'Teaser' },
    ].map((video, index) => ({
      ...video,
      id: `mock-${movie.id}-video-${index}`,
      iso_639_1: 'en',
      iso_3166_1: 'US',
      official: true,
      published_at: published,
      site: 'YouTube',
      size: 1080,
    }));
  }

  /** Invented availability for development; not real streaming data. */
  private providers(movie: MockMovieSeed) {
    const provider = (key: ProviderKey, priority: number) => ({
      display_priority: priority,
      logo_path: `/mock/logo/${MOCK_PROVIDERS[key].id}.svg`,
      provider_id: MOCK_PROVIDERS[key].id,
      provider_name: MOCK_PROVIDERS[key].name,
    });
    const storeFronts = [provider('apple', 4), provider('google', 6), provider('amazon', 8)];
    return Object.fromEntries(
      PROVIDER_REGIONS.map((region) => {
        // Hulu exists only in the US; elsewhere those movies stream on Disney Plus.
        const stream = movie.stream === 'hulu' && region !== 'US' ? 'disney' : movie.stream;
        return [
          region,
          {
            link: `https://www.themoviedb.org/movie/${movie.id}/watch?locale=${region}`,
            ...(stream ? { flatrate: [provider(stream, 1)] } : {}),
            rent: storeFronts,
            buy: storeFronts,
          },
        ];
      }),
    );
  }

  private similarTo(movie: MockMovieSeed): MockMovieSeed[] {
    return this.ranked(movie, (other) => {
      const shared = other.genres.filter((id) => movie.genres.includes(id)).length;
      return shared * 2 + (other.language === movie.language ? 1 : 0);
    });
  }

  private recommendationsFor(movie: MockMovieSeed): MockMovieSeed[] {
    const people = new Set([
      ...(this.castIds.get(movie.id) ?? []),
      ...(this.crewIds.get(movie.id) ?? []),
    ]);
    return this.ranked(movie, (other) => {
      const sharedPeople = [
        ...(this.castIds.get(other.id) ?? []),
        ...(this.crewIds.get(other.id) ?? []),
      ].filter((id) => people.has(id)).length;
      const sharedGenres = other.genres.filter((id) => movie.genres.includes(id)).length;
      return sharedPeople * 3 + sharedGenres;
    });
  }

  private ranked(movie: MockMovieSeed, score: (other: MockMovieSeed) => number): MockMovieSeed[] {
    return [...this.movies.values()]
      .filter((other) => other.id !== movie.id)
      .map((other) => ({ other, value: score(other) }))
      .filter((entry) => entry.value > 1)
      .sort((a, b) => b.value - a.value || b.other.popularity - a.other.popularity)
      .slice(0, 20)
      .map((entry) => entry.other);
  }

  private personDetails(id: number, params: TmdbParams, now: Date) {
    const person = this.people.get(id);
    if (!person) throw new TmdbNotFoundError(`Mock person ${id} not found`);
    const knownFor = this.knownFor(id)
      .slice(0, 3)
      .map((movie) => movie.title);
    const article = /^[aeiou]/i.test(person.summary) ? 'an' : 'a';
    const knownForText =
      knownFor.length > 1
        ? ` Known for ${knownFor.slice(0, -1).join(', ')} and ${knownFor.at(-1)}.`
        : knownFor.length === 1
          ? ` Known for ${knownFor[0]}.`
          : '';
    const details: Record<string, unknown> = {
      adult: false,
      also_known_as: [],
      biography: `${person.name} is ${article} ${person.summary}.${knownForText}`,
      birthday: person.birthday ?? null,
      deathday: null,
      gender: 0,
      homepage: null,
      id: person.id,
      imdb_id: null,
      known_for_department: person.department,
      name: person.name,
      place_of_birth: person.placeOfBirth ?? null,
      popularity: this.personPopularity(id),
      profile_path: `/mock/profile/${person.id}.svg`,
    };
    if (String(params.append_to_response ?? '').includes('movie_credits')) {
      const credits = this.credits.get(id) ?? [];
      details.movie_credits = {
        cast: credits
          .filter((credit) => credit.character !== undefined)
          .map((credit) => ({
            ...this.listItem(this.movies.get(credit.movieId)!, params, now),
            character: credit.character,
            credit_id: `mock-${credit.movieId}-cast-${credit.order}`,
            order: credit.order,
          })),
        crew: credits
          .filter((credit) => credit.job !== undefined)
          .map((credit) => ({
            ...this.listItem(this.movies.get(credit.movieId)!, params, now),
            credit_id: `mock-${credit.movieId}-crew-${credit.order}`,
            department: department(credit.job!),
            job: credit.job,
          })),
      };
    }
    return details;
  }

  /** The person's movies, most popular first, without duplicates. */
  private knownFor(personId: number): MockMovieSeed[] {
    const ids = [...new Set((this.credits.get(personId) ?? []).map((credit) => credit.movieId))];
    return ids.map((id) => this.movies.get(id)!).sort((a, b) => b.popularity - a.popularity);
  }

  private personPopularity(personId: number): number {
    const total = this.knownFor(personId).reduce((sum, movie) => sum + movie.popularity, 0);
    return Math.round(total * 10) / 100;
  }
}
