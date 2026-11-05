import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, notExists, sql } from 'drizzle-orm';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  groupMembers,
  groupMovieRatings,
  groupMovies,
  groups,
  movies,
  movieViews,
  profiles,
  userMovies,
} from '../database/schema/index.js';
import { LocalCatalogService } from '../movies/local-catalog.service.js';
import type { Locale } from '../movies/locale.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import type { MovieSummary } from '../movies/movie.types.js';
import { MoviesService } from '../movies/movies.service.js';

export interface RecommendationSection {
  key:
    | 'because_you_liked'
    | 'favorite_genres'
    | 'popular_in_groups'
    | 'highly_rated'
    | 'hidden_gems'
    | 'continue_exploring';
  title: string;
  /** The movie a "because you liked" section is based on. */
  basedOn?: MovieSummary;
  movies: MovieSummary[];
}

const SECTION_SIZE = 12;

/**
 * Basic personalised recommendations: preference matching on favorite genres and liked movies,
 * TMDB recommendations, and what the user's groups enjoy. Everything already in the user's
 * catalog (including movies marked "not interested") is left out.
 */
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly movies: MoviesService,
    private readonly local: LocalCatalogService,
    private readonly presenter: MoviePresenter,
  ) {}

  async forUser(userId: string, locale: Locale): Promise<RecommendationSection[]> {
    const excluded = await this.catalogTmdbIds(userId);
    const keep = (list: MovieSummary[]) => this.unique(list.filter((m) => !excluded.has(m.tmdbId)));

    const sections = await Promise.all([
      this.becauseYouLiked(userId, locale, keep),
      this.favoriteGenres(userId, locale, keep),
      this.popularInGroups(userId, excluded),
      this.highlyRated(locale, keep),
      this.hiddenGems(locale, keep),
    ]);
    return sections.filter((section): section is RecommendationSection =>
      Boolean(section && section.movies.length),
    );
  }

  /** Similar titles to what the user explored recently ("Continue exploring"). */
  async continueExploring(userId: string, locale: Locale): Promise<RecommendationSection | null> {
    const recent = await this.db
      .select({ tmdbId: movies.tmdbId })
      .from(movieViews)
      .innerJoin(movies, eq(movies.id, movieViews.movieId))
      .where(eq(movieViews.userId, userId))
      .orderBy(desc(movieViews.lastViewedAt))
      .limit(3);
    if (recent.length === 0) return null;
    const excluded = await this.catalogTmdbIds(userId);
    const viewed = new Set(recent.map((r) => r.tmdbId));
    const lists = await Promise.all(
      recent.map((r) => this.safe(() => this.movies.similar(r.tmdbId, { page: 1, locale }))),
    );
    const merged = this.interleave(lists.map((list) => list?.items ?? [])).filter(
      (m) => !excluded.has(m.tmdbId) && !viewed.has(m.tmdbId),
    );
    return {
      key: 'continue_exploring',
      title: 'Continue exploring',
      movies: this.unique(merged).slice(0, SECTION_SIZE),
    };
  }

  private async becauseYouLiked(
    userId: string,
    locale: Locale,
    keep: (list: MovieSummary[]) => MovieSummary[],
  ): Promise<RecommendationSection | null> {
    const [liked] = await this.db
      .select({ movie: movies })
      .from(userMovies)
      .innerJoin(movies, eq(movies.id, userMovies.movieId))
      .where(
        and(
          eq(userMovies.userId, userId),
          sql`(${userMovies.isFavorite} or ${userMovies.rating} >= 8)`,
        ),
      )
      .orderBy(desc(userMovies.updatedAt))
      .limit(1);
    if (!liked) return null;
    let candidates: MovieSummary[];
    try {
      const details = await this.movies.details(liked.movie.tmdbId, { locale });
      candidates = details.recommendations.length ? details.recommendations : details.similar;
    } catch {
      candidates = await this.local.similar(liked.movie, 30);
    }
    return {
      key: 'because_you_liked',
      title: `Because you liked ${liked.movie.title}`,
      basedOn: this.presenter.fromRow(liked.movie),
      movies: keep(candidates).slice(0, SECTION_SIZE),
    };
  }

  private async favoriteGenres(
    userId: string,
    locale: Locale,
    keep: (list: MovieSummary[]) => MovieSummary[],
  ): Promise<RecommendationSection | null> {
    const [profile] = await this.db
      .select({ genreIds: profiles.favoriteGenreIds })
      .from(profiles)
      .where(eq(profiles.id, userId));
    let genreIds = profile?.genreIds ?? [];
    if (genreIds.length === 0) {
      // No stated preference: use the genres of movies the user watched.
      const top = await this.db.execute<{ genre_id: number }>(sql`
        select genre_id from ${userMovies} um join ${movies} m on m.id = um.movie_id
        cross join lateral unnest(m.genre_ids) as genre_id
        where um.user_id = ${userId} and um.status = 'watched'
        group by genre_id order by count(*) desc limit 2
      `);
      genreIds = top.rows.map((row) => Number(row.genre_id));
    }
    if (genreIds.length === 0) return null;
    const result = await this.movies.discover(
      { genreIds, genreMatch: 'any', minVotes: 300, sort: 'popularity' },
      { page: 1, locale },
    );
    return {
      key: 'favorite_genres',
      title: 'Based on your favorite genres',
      movies: keep(result.items).slice(0, SECTION_SIZE),
    };
  }

  /** Movies the user's groups rate highly or want to watch, that the user has not saved yet. */
  private async popularInGroups(
    userId: string,
    excluded: Set<number>,
  ): Promise<RecommendationSection | null> {
    const myGroups = this.db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.userId, userId), isNull(groups.archivedAt)));
    const rows = await this.db
      .select({
        movie: movies,
        score:
          sql<number>`count(distinct ${groupMovies.groupId}) * 2 + coalesce(avg(${groupMovieRatings.rating}), 0) / 2`.mapWith(
            Number,
          ),
      })
      .from(groupMovies)
      .innerJoin(movies, eq(movies.id, groupMovies.movieId))
      .leftJoin(
        groupMovieRatings,
        and(
          eq(groupMovieRatings.groupId, groupMovies.groupId),
          eq(groupMovieRatings.movieId, groupMovies.movieId),
        ),
      )
      .where(
        and(
          inArray(groupMovies.groupId, myGroups),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(userMovies)
              .where(
                and(eq(userMovies.userId, userId), eq(userMovies.movieId, groupMovies.movieId)),
              ),
          ),
        ),
      )
      .groupBy(movies.id)
      .orderBy(sql`2 desc`)
      .limit(SECTION_SIZE);
    const items = rows
      .map((row) => this.presenter.fromRow(row.movie))
      .filter((m) => !excluded.has(m.tmdbId));
    return items.length
      ? { key: 'popular_in_groups', title: 'Popular in your groups', movies: items }
      : null;
  }

  private async highlyRated(
    locale: Locale,
    keep: (list: MovieSummary[]) => MovieSummary[],
  ): Promise<RecommendationSection> {
    const result = await this.movies.list('top-rated', { page: 1, locale });
    return {
      key: 'highly_rated',
      title: 'Highly rated movies you have not watched',
      movies: keep(result.items).slice(0, SECTION_SIZE),
    };
  }

  private async hiddenGems(
    locale: Locale,
    keep: (list: MovieSummary[]) => MovieSummary[],
  ): Promise<RecommendationSection> {
    const result = await this.movies.discover(
      { minRating: 7.5, minVotes: 100, sort: 'rating' },
      { page: 1, locale },
    );
    // Lesser-known titles: below the most-voted blockbusters.
    const gems = result.items.filter((m) => (m.voteCount ?? 0) < 5000);
    return { key: 'hidden_gems', title: 'Hidden gems', movies: keep(gems).slice(0, SECTION_SIZE) };
  }

  private async catalogTmdbIds(userId: string): Promise<Set<number>> {
    const rows = await this.db
      .select({ tmdbId: movies.tmdbId })
      .from(userMovies)
      .innerJoin(movies, eq(movies.id, userMovies.movieId))
      .where(eq(userMovies.userId, userId));
    return new Set(rows.map((row) => row.tmdbId));
  }

  private unique(list: MovieSummary[]): MovieSummary[] {
    const seen = new Set<number>();
    return list.filter((m) => !seen.has(m.tmdbId) && (seen.add(m.tmdbId), true));
  }

  private interleave(lists: MovieSummary[][]): MovieSummary[] {
    const result: MovieSummary[] = [];
    const longest = Math.max(0, ...lists.map((list) => list.length));
    for (let i = 0; i < longest; i += 1) {
      for (const list of lists) if (list[i]) result.push(list[i]!);
    }
    return result;
  }

  private async safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      this.logger.debug(`Recommendation source skipped: ${(error as Error).message}`);
      return undefined;
    }
  }
}
