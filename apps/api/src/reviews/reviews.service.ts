import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { offsetOf, type Paginated, paginated } from '../common/dto/pagination.dto.js';
import { notFound } from '../common/errors.js';
import { displayName } from '../common/utils/display-name.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { movies, profiles, reviews, userMovies } from '../database/schema/index.js';
import { MovieStore } from '../movies/movie-store.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import type { MovieRow, MovieSummary } from '../movies/movie.types.js';
import type { UpsertReviewDto } from './dto/reviews.dto.js';

type ReviewRow = typeof reviews.$inferSelect;

export interface ReviewView {
  id: string;
  movie: MovieSummary;
  body: string;
  rating: number | null;
  containsSpoilers: boolean;
  isPublic: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicReviewView {
  id: string;
  author: { username: string | null; displayName: string; avatarUrl: string | null };
  body: string;
  rating: number | null;
  containsSpoilers: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly store: MovieStore,
    private readonly presenter: MoviePresenter,
  ) {}

  async listMine(userId: string, page: number, pageSize: number): Promise<Paginated<ReviewView>> {
    const rows = await this.db
      .select({
        review: reviews,
        movie: movies,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(reviews)
      .innerJoin(movies, eq(movies.id, reviews.movieId))
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.updatedAt))
      .limit(pageSize)
      .offset(offsetOf(page, pageSize));
    return paginated(
      rows.map((row) => this.toView(row.review, row.movie)),
      rows[0]?.total ?? 0,
      page,
      pageSize,
    );
  }

  async getMine(userId: string, tmdbId: number): Promise<ReviewView> {
    const [row] = await this.db
      .select({ review: reviews, movie: movies })
      .from(reviews)
      .innerJoin(movies, eq(movies.id, reviews.movieId))
      .where(and(eq(reviews.userId, userId), eq(movies.tmdbId, tmdbId)));
    if (!row) throw notFound('REVIEW_NOT_FOUND', 'You have not reviewed this movie.');
    return this.toView(row.review, row.movie);
  }

  async upsert(
    userId: string,
    tmdbId: number,
    dto: UpsertReviewDto,
  ): Promise<{ review: ReviewView; created: boolean }> {
    const movie = await this.store.ensure(tmdbId);
    const created = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(reviews)
        .where(and(eq(reviews.userId, userId), eq(reviews.movieId, movie.id)))
        .for('update');
      const isPublic = dto.isPublic ?? existing?.isPublic ?? false;
      const values = {
        body: dto.body,
        rating: dto.rating !== undefined ? dto.rating : (existing?.rating ?? null),
        containsSpoilers: dto.containsSpoilers ?? existing?.containsSpoilers ?? false,
        isPublic,
        publishedAt: isPublic ? (existing?.publishedAt ?? new Date()) : null,
      };
      if (existing) {
        await tx.update(reviews).set(values).where(eq(reviews.id, existing.id));
      } else {
        await tx.insert(reviews).values({ userId, movieId: movie.id, ...values });
      }

      // Writing a review implies the user has seen the movie; keep the catalog consistent.
      await tx
        .insert(userMovies)
        .values({
          userId,
          movieId: movie.id,
          status: 'watched',
          rating: values.rating,
          statusChangedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userMovies.userId, userMovies.movieId],
          set: { rating: dto.rating !== undefined ? dto.rating : sql`${userMovies.rating}` },
        });
      return !existing;
    });
    return { review: await this.getMine(userId, tmdbId), created };
  }

  async remove(userId: string, tmdbId: number): Promise<void> {
    const movie = await this.store.findByTmdbId(tmdbId);
    const deleted = movie
      ? await this.db
          .delete(reviews)
          .where(and(eq(reviews.userId, userId), eq(reviews.movieId, movie.id)))
          .returning({ id: reviews.id })
      : [];
    if (deleted.length === 0)
      throw notFound('REVIEW_NOT_FOUND', 'You have not reviewed this movie.');
  }

  /** Published reviews of a movie, newest first. Authors are shown by name, never by email. */
  async listPublic(
    tmdbId: number,
    page: number,
    pageSize: number,
  ): Promise<Paginated<PublicReviewView>> {
    const rows = await this.db
      .select({
        review: reviews,
        author: {
          username: profiles.username,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          avatarUrl: profiles.avatarUrl,
        },
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(reviews)
      .innerJoin(movies, eq(movies.id, reviews.movieId))
      .innerJoin(profiles, eq(profiles.id, reviews.userId))
      .where(and(eq(movies.tmdbId, tmdbId), eq(reviews.isPublic, true)))
      .orderBy(desc(reviews.publishedAt))
      .limit(pageSize)
      .offset(offsetOf(page, pageSize));
    return paginated(
      rows.map(({ review, author }) => ({
        id: review.id,
        author: {
          username: author.username,
          displayName: displayName(author),
          avatarUrl: author.avatarUrl,
        },
        body: review.body,
        rating: review.rating,
        containsSpoilers: review.containsSpoilers,
        publishedAt: review.publishedAt,
        updatedAt: review.updatedAt,
      })),
      rows[0]?.total ?? 0,
      page,
      pageSize,
    );
  }

  private toView(review: ReviewRow, movie: MovieRow): ReviewView {
    return {
      id: review.id,
      movie: this.presenter.fromRow(movie),
      body: review.body,
      rating: review.rating,
      containsSpoilers: review.containsSpoilers,
      isPublic: review.isPublic,
      publishedAt: review.publishedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
