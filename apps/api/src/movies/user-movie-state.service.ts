import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { movies, userMovies } from '../database/schema/index.js';
import type { MovieSummary, UserMovieState } from './movie.types.js';

/** Adds the signed-in user's status / favorite / rating to movie cards (one query per page). */
@Injectable()
export class UserMovieStateService {
  constructor(@InjectDb() private readonly db: Database) {}

  async statesFor(userId: string, tmdbIds: number[]): Promise<Map<number, UserMovieState>> {
    if (tmdbIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        tmdbId: movies.tmdbId,
        status: userMovies.status,
        isFavorite: userMovies.isFavorite,
        rating: userMovies.rating,
        lastWatchedOn: userMovies.lastWatchedOn,
      })
      .from(userMovies)
      .innerJoin(movies, eq(movies.id, userMovies.movieId))
      .where(and(eq(userMovies.userId, userId), inArray(movies.tmdbId, [...new Set(tmdbIds)])));
    return new Map(rows.map(({ tmdbId, ...state }) => [tmdbId, state]));
  }

  async annotate<T extends MovieSummary>(userId: string | undefined, items: T[]): Promise<T[]> {
    if (!userId || items.length === 0) return items;
    const states = await this.statesFor(
      userId,
      items.map((item) => item.tmdbId),
    );
    return items.map((item) => ({ ...item, userState: states.get(item.tmdbId) ?? null }));
  }
}
