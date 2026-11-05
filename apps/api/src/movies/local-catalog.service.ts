import { Injectable } from '@nestjs/common';
import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  between,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { addDays, todayIsoDate } from '../common/utils/dates.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { movies } from '../database/schema/index.js';
import { certificationsUpTo } from './certifications.js';
import type { DiscoverFilters } from './discover-filters.js';
import { MoviePresenter } from './movie.presenter.js';
import type { MovieListResult, MovieRow, MovieSummary } from './movie.types.js';
import { ascNullsLast, descNullsLast, intArray, likePattern } from './sql-helpers.js';

export const PAGE_SIZE = 20;

export type MovieListKind = 'popular' | 'trending' | 'top-rated' | 'upcoming' | 'now-playing';

/**
 * Discovery over the local `movies` table: the bundled sample plus every movie users have saved
 * or opened. Used when TMDB is not configured or unreachable.
 */
@Injectable()
export class LocalCatalogService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly presenter: MoviePresenter,
  ) {}

  list(kind: MovieListKind, page: number): Promise<MovieListResult> {
    const today = todayIsoDate();
    switch (kind) {
      case 'popular':
      case 'trending':
        return this.page(undefined, [descNullsLast(movies.popularity)], page);
      case 'top-rated':
        return this.page(gte(movies.voteCount, 500), [descNullsLast(movies.voteAverage)], page);
      case 'upcoming':
        return this.page(gt(movies.releaseDate, today), [asc(movies.releaseDate)], page);
      case 'now-playing':
        return this.page(
          between(movies.releaseDate, todayIsoDate(addDays(new Date(), -60)), today),
          [desc(movies.releaseDate)],
          page,
        );
    }
  }

  search(query: string, year: number | undefined, page: number): Promise<MovieListResult> {
    const pattern = likePattern(query);
    const conditions: SQL[] = [
      or(ilike(movies.title, pattern), ilike(movies.originalTitle, pattern)) as SQL,
    ];
    if (year) conditions.push(between(movies.releaseDate, `${year}-01-01`, `${year}-12-31`));
    return this.page(
      and(...conditions),
      [
        sql`extensions.similarity(${movies.title}, ${query}) desc`,
        descNullsLast(movies.popularity),
      ],
      page,
    );
  }

  async discover(filters: DiscoverFilters, page: number): Promise<MovieListResult> {
    // Cast and crew are not stored locally, so these filters cannot match offline.
    if (filters.castIds?.length || filters.crewIds?.length) {
      return { items: [], page, totalPages: 0, totalResults: 0, source: 'local' };
    }
    const today = todayIsoDate();
    const conditions: (SQL | undefined)[] = [];
    if (filters.genreIds?.length) {
      conditions.push(
        filters.genreMatch === 'all'
          ? arrayContains(movies.genreIds, filters.genreIds)
          : arrayOverlaps(movies.genreIds, filters.genreIds),
      );
    }
    if (filters.yearFrom) conditions.push(gte(movies.releaseDate, `${filters.yearFrom}-01-01`));
    if (filters.yearTo) conditions.push(lte(movies.releaseDate, `${filters.yearTo}-12-31`));
    if (filters.releaseState === 'released') conditions.push(lte(movies.releaseDate, today));
    if (filters.releaseState === 'upcoming') conditions.push(gt(movies.releaseDate, today));
    if (filters.originalLanguage)
      conditions.push(eq(movies.originalLanguage, filters.originalLanguage));
    if (filters.originCountry)
      conditions.push(arrayContains(movies.originCountries, [filters.originCountry]));
    if (filters.minRating !== undefined)
      conditions.push(gte(movies.voteAverage, filters.minRating));
    if (filters.maxRating !== undefined)
      conditions.push(lte(movies.voteAverage, filters.maxRating));
    if (filters.minVotes !== undefined) conditions.push(gte(movies.voteCount, filters.minVotes));
    if (filters.minRuntime !== undefined) conditions.push(gte(movies.runtime, filters.minRuntime));
    if (filters.maxRuntime !== undefined) conditions.push(lte(movies.runtime, filters.maxRuntime));
    if (filters.maxCertification) {
      const country = filters.certificationCountry ?? 'US';
      const allowed = certificationsUpTo(country, filters.maxCertification) ?? [
        filters.maxCertification,
      ];
      conditions.push(inArray(sql`${movies.certifications} ->> ${country}`, allowed));
    }

    const order: SQL[] = (() => {
      switch (filters.sort ?? 'popularity') {
        case 'rating':
          return [descNullsLast(movies.voteAverage)];
        case 'newest':
          return [descNullsLast(movies.releaseDate)];
        case 'oldest':
          return [ascNullsLast(movies.releaseDate)];
        case 'title':
          return [sql`${movies.title} asc`];
        case 'popularity':
          return [descNullsLast(movies.popularity)];
      }
    })();
    return this.page(and(...conditions), order, page);
  }

  /** Movies sharing the most genres with `movie`. */
  async similar(movie: MovieRow, limit = 12): Promise<MovieSummary[]> {
    if (movie.genreIds.length === 0) return [];
    const overlap = sql`cardinality(array(select unnest(${movies.genreIds}) intersect select unnest(${intArray(movie.genreIds)})))`;
    const rows = await this.db
      .select()
      .from(movies)
      .where(and(ne(movies.id, movie.id), arrayOverlaps(movies.genreIds, movie.genreIds)))
      .orderBy(sql`${overlap} desc`, descNullsLast(movies.voteAverage))
      .limit(limit);
    return rows.map((row) => this.presenter.fromRow(row));
  }

  private async page(
    where: SQL | undefined,
    orderBy: SQL[],
    page: number,
  ): Promise<MovieListResult> {
    const rows = await this.db
      .select({ movie: movies, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(movies)
      .where(where)
      .orderBy(...orderBy, asc(movies.tmdbId))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
    const total = rows[0]?.total ?? 0;
    return {
      items: rows.map((row) => this.presenter.fromRow(row.movie)),
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      totalResults: total,
      source: 'local',
    };
  }
}
