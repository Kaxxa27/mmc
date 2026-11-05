import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  groupMembers,
  groups,
  movieNights,
  movies,
  notifications,
  type NotificationType,
} from '../database/schema/index.js';
import { UserDirectoryService } from '../groups/user-directory.service.js';
import { LibraryService } from '../library/library.service.js';
import type { LibraryEntry } from '../library/library.types.js';
import type { MovieListKind } from '../movies/local-catalog.service.js';
import type { Locale } from '../movies/locale.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import type { MovieSummary } from '../movies/movie.types.js';
import { MoviesService } from '../movies/movies.service.js';
import { type RecommendationSection, RecommendationsService } from './recommendations.service.js';

export interface HomeSection {
  key: string;
  title: string;
  movies: MovieSummary[];
}

export interface HomeView {
  /** Present for signed-in users. */
  welcome: { displayName: string } | null;
  sections: HomeSection[];
  recentlyAdded: LibraryEntry[] | null;
  watchlist: LibraryEntry[] | null;
  upcomingMovieNights:
    | {
        id: string;
        title: string;
        scheduledAt: Date | null;
        status: string;
        group: { id: string; name: string };
        selectedMovie: MovieSummary | null;
      }[]
    | null;
  groupActivity:
    | { type: NotificationType; title: string; data: Record<string, unknown>; createdAt: Date }[]
    | null;
}

const PUBLIC_SECTIONS: { key: MovieListKind; title: string }[] = [
  { key: 'trending', title: 'Trending this week' },
  { key: 'popular', title: 'Popular movies' },
  { key: 'top-rated', title: 'Top rated' },
  { key: 'now-playing', title: 'Now playing' },
  { key: 'upcoming', title: 'Coming soon' },
];

const GROUP_ACTIVITY: NotificationType[] = [
  'group_movie_added',
  'group_movie_rated',
  'group_member_joined',
  'movie_night_scheduled',
  'movie_night_decided',
];

const SECTION_SIZE = 12;

/** Everything the home page needs in one request, personalised when signed in. */
@Injectable()
export class HomeService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly movies: MoviesService,
    private readonly library: LibraryService,
    private readonly recommendations: RecommendationsService,
    private readonly directory: UserDirectoryService,
    private readonly presenter: MoviePresenter,
  ) {}

  async home(user: AuthUser | undefined, locale: Locale): Promise<HomeView> {
    const publicSections = await Promise.all(
      PUBLIC_SECTIONS.map(async ({ key, title }) => {
        const result = await this.movies.list(key, { page: 1, locale, userId: user?.id });
        return { key, title, movies: result.items.slice(0, SECTION_SIZE) };
      }),
    );
    if (!user) {
      return {
        welcome: null,
        sections: publicSections.filter((s) => s.movies.length > 0),
        recentlyAdded: null,
        watchlist: null,
        upcomingMovieNights: null,
        groupActivity: null,
      };
    }

    const [person, personal, continueExploring, recentlyAdded, watchlist, nights, activity] =
      await Promise.all([
        this.directory.person(user.id),
        this.recommendations.forUser(user.id, locale),
        this.recommendations.continueExploring(user.id, locale),
        this.library.list(user.id, { page: 1, pageSize: SECTION_SIZE, sort: 'added_desc' }),
        this.library.list(user.id, {
          page: 1,
          pageSize: SECTION_SIZE,
          status: ['want_to_watch'],
          sort: 'added_desc',
        }),
        this.upcomingMovieNights(user.id),
        this.db
          .select({
            type: notifications.type,
            title: notifications.title,
            data: notifications.data,
            createdAt: notifications.createdAt,
          })
          .from(notifications)
          .where(
            and(eq(notifications.userId, user.id), inArray(notifications.type, GROUP_ACTIVITY)),
          )
          .orderBy(desc(notifications.createdAt))
          .limit(10),
      ]);

    const recommended: RecommendationSection[] = [
      ...personal.filter(
        (s) =>
          s.key === 'because_you_liked' ||
          s.key === 'favorite_genres' ||
          s.key === 'popular_in_groups',
      ),
      ...(continueExploring && continueExploring.movies.length ? [continueExploring] : []),
    ];
    return {
      welcome: { displayName: person?.displayName ?? 'Movie fan' },
      sections: [
        ...recommended.map((s) => ({ key: s.key, title: s.title, movies: s.movies })),
        ...publicSections,
      ].filter((s) => s.movies.length > 0),
      recentlyAdded: recentlyAdded.items,
      watchlist: watchlist.items,
      upcomingMovieNights: nights,
      groupActivity: activity,
    };
  }

  private async upcomingMovieNights(userId: string) {
    const rows = await this.db
      .select({ night: movieNights, groupName: groups.name, movie: movies })
      .from(movieNights)
      .innerJoin(groups, eq(groups.id, movieNights.groupId))
      .innerJoin(
        groupMembers,
        and(eq(groupMembers.groupId, movieNights.groupId), eq(groupMembers.userId, userId)),
      )
      .leftJoin(movies, eq(movies.id, movieNights.selectedMovieId))
      .where(
        and(
          isNull(groups.archivedAt),
          inArray(movieNights.status, ['planning', 'voting', 'decided']),
          sql`(${movieNights.scheduledAt} is null or ${movieNights.scheduledAt} >= now() - interval '6 hours')`,
        ),
      )
      .orderBy(sql`${movieNights.scheduledAt} asc nulls last`, asc(movieNights.createdAt))
      .limit(5);
    return rows.map(({ night, groupName, movie }) => ({
      id: night.id,
      title: night.title,
      scheduledAt: night.scheduledAt,
      status: night.status,
      group: { id: night.groupId, name: groupName },
      selectedMovie: movie ? this.presenter.fromRow(movie) : null,
    }));
  }
}
