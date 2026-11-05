import { Injectable } from '@nestjs/common';
import { and, asc, between, eq, exists, inArray, ne, sql } from 'drizzle-orm';
import { badRequest } from '../common/errors.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  groupMembers,
  groupMovies,
  groups,
  movieNightParticipants,
  movieNights,
  movies,
  userMovies,
  watchEvents,
  type MovieNightStatus,
} from '../database/schema/index.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import type { MovieRow, MovieSummary } from '../movies/movie.types.js';

export type CalendarEvent =
  | {
      type: 'viewing';
      date: string;
      id: string;
      movie: MovieSummary;
      rating: number | null;
      isRewatch: boolean;
      movieNightId: string | null;
    }
  | {
      type: 'movie_night';
      date: string;
      startsAt: Date;
      id: string;
      title: string;
      status: MovieNightStatus;
      group: { id: string; name: string };
      selectedMovie: MovieSummary | null;
      isParticipant: boolean;
    }
  | { type: 'release'; date: string; movie: MovieSummary }
  | {
      type: 'watched_together';
      date: string;
      group: { id: string; name: string };
      movie: MovieSummary;
    };

export interface CalendarView {
  from: string;
  to: string;
  events: CalendarEvent[];
}

const MAX_RANGE_DAYS = 400;

/** Calendar of past viewings, planned movie nights and upcoming releases. */
@Injectable()
export class CalendarService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: GroupAccessService,
    private readonly presenter: MoviePresenter,
  ) {}

  async forUser(userId: string, query: { from?: string; to?: string }): Promise<CalendarView> {
    const { from, to } = this.range(query);
    const groupIds = (
      await this.db
        .select({ id: groupMembers.groupId })
        .from(groupMembers)
        .where(eq(groupMembers.userId, userId))
    ).map((row) => row.id);

    const [viewings, nights, releases] = await Promise.all([
      this.db
        .select({ event: watchEvents, movie: movies })
        .from(watchEvents)
        .innerJoin(movies, eq(movies.id, watchEvents.movieId))
        .where(and(eq(watchEvents.userId, userId), between(watchEvents.watchedOn, from, to))),
      this.movieNights(groupIds, from, to, userId),
      this.db
        .select({ movie: movies })
        .from(userMovies)
        .innerJoin(movies, eq(movies.id, userMovies.movieId))
        .where(
          and(
            eq(userMovies.userId, userId),
            eq(userMovies.status, 'want_to_watch'),
            between(movies.releaseDate, from, to),
          ),
        ),
    ]);

    const events: CalendarEvent[] = [
      ...viewings.map(({ event, movie }) => ({
        type: 'viewing' as const,
        date: event.watchedOn,
        id: event.id,
        movie: this.presenter.fromRow(movie),
        rating: event.rating,
        isRewatch: event.isRewatch,
        movieNightId: event.movieNightId,
      })),
      ...nights,
      ...releases.map(({ movie }) => ({
        type: 'release' as const,
        date: movie.releaseDate!,
        movie: this.presenter.fromRow(movie),
      })),
    ];
    return { from, to, events: this.sort(events) };
  }

  async forGroup(
    groupId: string,
    userId: string,
    query: { from?: string; to?: string },
  ): Promise<CalendarView> {
    await this.access.require(groupId, userId, { allowArchived: true });
    const { from, to } = this.range(query);
    const [nights, watched, releases] = await Promise.all([
      this.movieNights([groupId], from, to, userId),
      this.db
        .select({ entry: groupMovies, movie: movies, groupName: groups.name })
        .from(groupMovies)
        .innerJoin(movies, eq(movies.id, groupMovies.movieId))
        .innerJoin(groups, eq(groups.id, groupMovies.groupId))
        .where(and(eq(groupMovies.groupId, groupId), between(groupMovies.watchedOn, from, to))),
      this.db
        .select({ movie: movies })
        .from(groupMovies)
        .innerJoin(movies, eq(movies.id, groupMovies.movieId))
        .where(
          and(
            eq(groupMovies.groupId, groupId),
            eq(groupMovies.status, 'want_to_watch'),
            between(movies.releaseDate, from, to),
          ),
        ),
    ]);
    const events: CalendarEvent[] = [
      ...nights,
      ...watched.map(({ entry, movie, groupName }) => ({
        type: 'watched_together' as const,
        date: entry.watchedOn!,
        group: { id: groupId, name: groupName },
        movie: this.presenter.fromRow(movie),
      })),
      ...releases.map(({ movie }) => ({
        type: 'release' as const,
        date: movie.releaseDate!,
        movie: this.presenter.fromRow(movie),
      })),
    ];
    return { from, to, events: this.sort(events) };
  }

  private async movieNights(
    groupIds: string[],
    from: string,
    to: string,
    userId: string,
  ): Promise<CalendarEvent[]> {
    if (groupIds.length === 0) return [];
    const rows = await this.db
      .select({
        night: movieNights,
        groupName: groups.name,
        isParticipant: exists(
          this.db
            .select({ one: sql`1` })
            .from(movieNightParticipants)
            .where(
              and(
                eq(movieNightParticipants.movieNightId, movieNights.id),
                eq(movieNightParticipants.userId, userId),
              ),
            ),
        ).mapWith(Boolean),
      })
      .from(movieNights)
      .innerJoin(groups, eq(groups.id, movieNights.groupId))
      .where(
        and(
          inArray(movieNights.groupId, groupIds),
          ne(movieNights.status, 'cancelled'),
          sql`${movieNights.scheduledAt} >= ${from}::date and ${movieNights.scheduledAt} < ${to}::date + interval '1 day'`,
        ),
      )
      .orderBy(asc(movieNights.scheduledAt));
    const selectedIds = rows.flatMap((row) =>
      row.night.selectedMovieId ? [row.night.selectedMovieId] : [],
    );
    const selected: MovieRow[] = selectedIds.length
      ? await this.db.select().from(movies).where(inArray(movies.id, selectedIds))
      : [];
    const byId = new Map(selected.map((m) => [m.id, m]));
    return rows.map(({ night, groupName, isParticipant }) => ({
      type: 'movie_night' as const,
      date: night.scheduledAt!.toISOString().slice(0, 10),
      startsAt: night.scheduledAt!,
      id: night.id,
      title: night.title,
      status: night.status,
      group: { id: night.groupId, name: groupName },
      selectedMovie:
        night.selectedMovieId && byId.has(night.selectedMovieId)
          ? this.presenter.fromRow(byId.get(night.selectedMovieId)!)
          : null,
      isParticipant,
    }));
  }

  private range(query: { from?: string; to?: string }): { from: string; to: string } {
    const now = new Date();
    const from =
      query.from ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const to =
      query.to ??
      (() => {
        const start = new Date(`${from}T00:00:00Z`);
        return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
          .toISOString()
          .slice(0, 10);
      })();
    if (to < from) throw badRequest('INVALID_RANGE', '`to` must not be before `from`.');
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (days > MAX_RANGE_DAYS)
      throw badRequest('RANGE_TOO_LARGE', `The range can cover at most ${MAX_RANGE_DAYS} days.`);
    return { from, to };
  }

  private sort(events: CalendarEvent[]): CalendarEvent[] {
    return events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  }
}
