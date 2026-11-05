import { Injectable } from '@nestjs/common';
import { notFound, serviceUnavailable } from '../common/errors.js';
import { CACHE_TTL, TmdbCacheService } from '../tmdb/tmdb-cache.service.js';
import { TmdbClient, TmdbNotFoundError, TmdbUnavailableError } from '../tmdb/tmdb.client.js';
import type {
  TmdbPaged,
  TmdbPerson,
  TmdbPersonCredit,
  TmdbPersonSearchItem,
} from '../tmdb/tmdb.types.js';
import { MoviePresenter } from './movie.presenter.js';
import type { PersonDetails, PersonMovieCredit, PersonSummary } from './movie.types.js';

/** Actors, directors and other crew (TMDB only: credits are not stored locally). */
@Injectable()
export class PeopleService {
  constructor(
    private readonly tmdb: TmdbClient,
    private readonly cache: TmdbCacheService,
    private readonly presenter: MoviePresenter,
  ) {}

  async search(query: string, page: number, language: string) {
    const data = await this.call(() =>
      this.cache.getOrFetch(
        `people:${language}:${page}:${query.toLowerCase()}`,
        CACHE_TTL.search,
        () =>
          this.tmdb.get<TmdbPaged<TmdbPersonSearchItem>>('/search/person', {
            query,
            page,
            language,
            include_adult: false,
          }),
      ),
    );
    return {
      items: data.results.map((person) => this.summary(person)),
      page: data.page,
      totalPages: Math.min(data.total_pages, 500),
      totalResults: data.total_results,
    };
  }

  async details(personId: number, language: string): Promise<PersonDetails> {
    const person = await this.call(() =>
      this.cache.getOrFetch(`person:${personId}:${language}`, CACHE_TTL.person, () =>
        this.tmdb.get<TmdbPerson>(`/person/${personId}`, {
          language,
          append_to_response: 'movie_credits',
        }),
      ),
    );
    const cast = person.movie_credits?.cast ?? [];
    const crew = person.movie_credits?.crew ?? [];
    return {
      tmdbId: person.id,
      name: person.name,
      profileUrl: this.presenter.image(person.profile_path, 'w500'),
      knownForDepartment: person.known_for_department,
      knownFor: [],
      biography: person.biography ? person.biography : null,
      birthday: person.birthday,
      deathday: person.deathday,
      placeOfBirth: person.place_of_birth,
      alsoKnownAs: person.also_known_as ?? [],
      acting: this.credits(cast, (c) => ({ character: c.character ? c.character : null })),
      directing: this.credits(
        crew.filter((c) => c.job === 'Director'),
        (c) => ({ job: c.job }),
      ),
      writing: this.credits(
        crew.filter((c) => c.department === 'Writing'),
        (c) => ({ job: c.job }),
      ),
      producing: this.credits(
        crew.filter((c) => c.job === 'Producer' || c.job === 'Executive Producer'),
        (c) => ({ job: c.job }),
      ),
    };
  }

  private summary(person: TmdbPersonSearchItem): PersonSummary {
    return {
      tmdbId: person.id,
      name: person.name,
      profileUrl: this.presenter.image(person.profile_path, 'w185'),
      knownForDepartment: person.known_for_department ?? null,
      knownFor: (person.known_for ?? [])
        .map((work) => work.title ?? work.name)
        .filter((title): title is string => Boolean(title))
        .slice(0, 3),
    };
  }

  /** Newest first, one entry per movie, adult titles removed. */
  private credits(
    credits: TmdbPersonCredit[],
    extra: (credit: TmdbPersonCredit) => Partial<PersonMovieCredit>,
  ): PersonMovieCredit[] {
    const seen = new Set<number>();
    return credits
      .filter((credit) => !credit.adult && !seen.has(credit.id) && (seen.add(credit.id), true))
      .sort((a, b) => (b.release_date || '0000').localeCompare(a.release_date || '0000'))
      .slice(0, 150)
      .map((credit) => ({ ...this.presenter.fromTmdbItem(credit), ...extra(credit) }));
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof TmdbNotFoundError)
        throw notFound('PERSON_NOT_FOUND', 'Person not found.');
      if (error instanceof TmdbUnavailableError) {
        throw serviceUnavailable(
          'PEOPLE_UNAVAILABLE',
          this.tmdb.enabled
            ? 'Cast and crew information is temporarily unavailable.'
            : 'Cast and crew information requires a TMDB key (offline mode).',
        );
      }
      throw error;
    }
  }
}
