import { Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser, ClientContext } from '../auth/auth.types.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  collectionItems,
  collections,
  comments,
  groupMembers,
  groupMovieRatings,
  groups,
  movieNightParticipants,
  movieNights,
  movieNightVotes,
  movies,
  notifications,
  profiles,
  reviews,
  userMovies,
  watchEvents,
} from '../database/schema/index.js';
import { MediaService } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

/** Personal data export and permanent account deletion. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly auth: AuthService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Everything the account owns or wrote, as one JSON document. */
  async export(userId: string): Promise<Record<string, unknown>> {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    const movieRef = { tmdbId: movies.tmdbId, title: movies.title };

    const [
      catalog,
      viewings,
      ownReviews,
      ownCollections,
      memberships,
      groupRatings,
      ownComments,
      nights,
      inbox,
    ] = await Promise.all([
      this.db
        .select({
          ...movieRef,
          status: userMovies.status,
          isFavorite: userMovies.isFavorite,
          rating: userMovies.rating,
          notes: userMovies.notes,
          lastWatchedOn: userMovies.lastWatchedOn,
          addedAt: userMovies.addedAt,
        })
        .from(userMovies)
        .innerJoin(movies, eq(movies.id, userMovies.movieId))
        .where(eq(userMovies.userId, userId))
        .orderBy(asc(userMovies.addedAt)),
      this.db
        .select({
          ...movieRef,
          watchedOn: watchEvents.watchedOn,
          rating: watchEvents.rating,
          notes: watchEvents.notes,
          isRewatch: watchEvents.isRewatch,
        })
        .from(watchEvents)
        .innerJoin(movies, eq(movies.id, watchEvents.movieId))
        .where(eq(watchEvents.userId, userId))
        .orderBy(asc(watchEvents.watchedOn)),
      this.db
        .select({
          ...movieRef,
          body: reviews.body,
          rating: reviews.rating,
          containsSpoilers: reviews.containsSpoilers,
          isPublic: reviews.isPublic,
          createdAt: reviews.createdAt,
          updatedAt: reviews.updatedAt,
        })
        .from(reviews)
        .innerJoin(movies, eq(movies.id, reviews.movieId))
        .where(eq(reviews.userId, userId)),
      this.db.select().from(collections).where(eq(collections.ownerId, userId)),
      this.db
        .select({
          groupId: groups.id,
          name: groups.name,
          role: groupMembers.role,
          joinedAt: groupMembers.joinedAt,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(eq(groupMembers.userId, userId)),
      this.db
        .select({
          group: groups.name,
          ...movieRef,
          rating: groupMovieRatings.rating,
          review: groupMovieRatings.review,
          updatedAt: groupMovieRatings.updatedAt,
        })
        .from(groupMovieRatings)
        .innerJoin(groups, eq(groups.id, groupMovieRatings.groupId))
        .innerJoin(movies, eq(movies.id, groupMovieRatings.movieId))
        .where(eq(groupMovieRatings.userId, userId)),
      this.db
        .select({ group: groups.name, body: comments.body, createdAt: comments.createdAt })
        .from(comments)
        .innerJoin(groups, eq(groups.id, comments.groupId))
        .where(eq(comments.authorId, userId)),
      this.db
        .select({
          title: movieNights.title,
          scheduledAt: movieNights.scheduledAt,
          status: movieNights.status,
          votedForTmdbId: sql<
            number | null
          >`(select m.tmdb_id from ${movieNightVotes} v join ${movies} m on m.id = v.movie_id where v.movie_night_id = ${movieNights.id} and v.user_id = ${userId})`,
        })
        .from(movieNightParticipants)
        .innerJoin(movieNights, eq(movieNights.id, movieNightParticipants.movieNightId))
        .where(eq(movieNightParticipants.userId, userId)),
      this.db
        .select({
          type: notifications.type,
          title: notifications.title,
          body: notifications.body,
          createdAt: notifications.createdAt,
          readAt: notifications.readAt,
        })
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(500),
    ]);

    const collectionsWithItems = await Promise.all(
      ownCollections.map(async (collection) => ({
        name: collection.name,
        description: collection.description,
        visibility: collection.visibility,
        groupId: collection.groupId,
        createdAt: collection.createdAt,
        movies: await this.db
          .select({ ...movieRef, note: collectionItems.note, addedAt: collectionItems.addedAt })
          .from(collectionItems)
          .innerJoin(movies, eq(movies.id, collectionItems.movieId))
          .where(eq(collectionItems.collectionId, collection.id))
          .orderBy(asc(collectionItems.position)),
      })),
    );

    return {
      exportedAt: new Date().toISOString(),
      format: 'my-movie-catalog-export/v1',
      profile,
      catalog,
      viewingHistory: viewings,
      reviews: ownReviews,
      collections: collectionsWithItems,
      groups: memberships,
      groupRatings,
      comments: ownComments,
      movieNights: nights,
      notifications: inbox,
    };
  }

  /**
   * Permanently deletes the account after re-verifying the email with a fresh code.
   * Groups the user owns are handed to another member (admins first) or deleted when empty.
   */
  async delete(user: AuthUser, code: string, client: ClientContext): Promise<void> {
    await this.auth.confirmIdentity(user, code, client);
    const newOwners: { groupId: string; name: string; ownerId: string }[] = [];

    await this.db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(eq(groups.ownerId, user.id))
        .for('update');
      for (const group of owned) {
        const [successor] = await tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, group.id), ne(groupMembers.userId, user.id)))
          .orderBy(
            sql`case ${groupMembers.role} when 'admin' then 0 else 1 end`,
            asc(groupMembers.joinedAt),
          )
          .limit(1);
        if (successor) {
          await tx
            .delete(groupMembers)
            .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)));
          await tx
            .update(groupMembers)
            .set({ role: 'owner' })
            .where(
              and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, successor.userId)),
            );
          await tx.update(groups).set({ ownerId: successor.userId }).where(eq(groups.id, group.id));
          newOwners.push({ groupId: group.id, name: group.name, ownerId: successor.userId });
        } else {
          await tx.delete(groups).where(eq(groups.id, group.id));
        }
      }
      await this.audit.record(
        {
          actorId: user.id,
          action: 'account.deleted',
          entityType: 'user',
          entityId: user.id,
          metadata: {
            transferredGroups: newOwners.length,
            deletedGroups: owned.length - newOwners.length,
          },
          ipAddress: client.ip,
        },
        tx,
      );
      // Cascades to the profile and every personal record (catalog, history, reviews, ...).
      await tx.execute(sql`delete from auth.users where id = ${user.id}::uuid`);
    });

    await this.media
      .removeFolder(`users/${user.id}/avatar`)
      .catch((error: unknown) =>
        this.logger.warn(`Could not delete avatar files: ${(error as Error).message}`),
      );
    for (const owner of newOwners) {
      await this.notifications.notify({
        recipientIds: [owner.ownerId],
        type: 'group_role_changed',
        title: `You are now the owner of ${owner.name}`,
        body: 'The previous owner deleted their account, so ownership was transferred to you.',
        data: { groupId: owner.groupId },
      });
    }
  }
}
