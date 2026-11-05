import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { offsetOf, type Paginated, paginated } from '../common/dto/pagination.dto.js';
import { forbidden, notFound } from '../common/errors.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { comments, groupMembers, movieNights, profiles } from '../database/schema/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { GroupAccessService, hasRole, type Membership } from './group-access.service.js';
import { GroupMoviesService } from './group-movies.service.js';
import { type PersonView, UserDirectoryService } from './user-directory.service.js';

type CommentRow = typeof comments.$inferSelect;

export interface CommentView {
  id: string;
  author: PersonView;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  edited: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/** `@username` mentions in a comment (unique, lower-case). */
export function extractMentions(body: string): string[] {
  const names = [...body.matchAll(/(?:^|[^a-z0-9_@])@([a-z0-9_]{3,30})(?![a-z0-9_])/gi)].map((m) =>
    m[1]!.toLowerCase(),
  );
  return [...new Set(names)];
}

type Target = { movieId: string; tmdbId: number } | { movieNightId: string };

/** Discussions inside a group, on shared-catalog movies and on movie nights. */
@Injectable()
export class CommentsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: GroupAccessService,
    private readonly directory: UserDirectoryService,
    private readonly groupMovies: GroupMoviesService,
    private readonly notifications: NotificationsService,
  ) {}

  async listForMovie(
    groupId: string,
    userId: string,
    tmdbId: number,
    page: number,
    pageSize: number,
  ) {
    const membership = await this.access.require(groupId, userId, { allowArchived: true });
    const entry = await this.groupMovies.entry(groupId, tmdbId);
    return this.list(membership, userId, eq(comments.movieId, entry.movieId), page, pageSize);
  }

  async addToMovie(
    groupId: string,
    userId: string,
    tmdbId: number,
    body: string,
  ): Promise<CommentView> {
    const membership = await this.access.require(groupId, userId);
    const entry = await this.groupMovies.entry(groupId, tmdbId);
    return this.add(membership, userId, body, { movieId: entry.movieId, tmdbId });
  }

  async listForMovieNight(movieNightId: string, userId: string, page: number, pageSize: number) {
    const membership = await this.movieNightMembership(movieNightId, userId, true);
    return this.list(membership, userId, eq(comments.movieNightId, movieNightId), page, pageSize);
  }

  async addToMovieNight(movieNightId: string, userId: string, body: string): Promise<CommentView> {
    const membership = await this.movieNightMembership(movieNightId, userId, false);
    return this.add(membership, userId, body, { movieNightId });
  }

  async update(
    groupId: string,
    commentId: string,
    userId: string,
    body: string,
  ): Promise<CommentView> {
    const membership = await this.access.require(groupId, userId);
    const comment = await this.find(groupId, commentId);
    if (comment.authorId !== userId)
      throw forbidden('NOT_COMMENT_AUTHOR', 'Only the author can edit a comment.');
    const [updated] = await this.db
      .update(comments)
      .set({ body })
      .where(eq(comments.id, commentId))
      .returning();
    return (await this.toViews([updated!], membership, userId))[0]!;
  }

  /** Authors can delete their comments; admins and the owner can delete any comment. */
  async remove(groupId: string, commentId: string, userId: string): Promise<void> {
    const membership = await this.access.require(groupId, userId, { allowArchived: true });
    const comment = await this.find(groupId, commentId);
    if (comment.authorId !== userId && !hasRole(membership.role, 'admin')) {
      throw forbidden('GROUP_PERMISSION_DENIED', 'You cannot delete this comment.');
    }
    await this.db.delete(comments).where(eq(comments.id, commentId));
  }

  private async list(
    membership: Membership,
    userId: string,
    target: ReturnType<typeof eq>,
    page: number,
    pageSize: number,
  ): Promise<Paginated<CommentView>> {
    const rows = await this.db
      .select({ comment: comments, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(comments)
      .where(and(eq(comments.groupId, membership.groupId), target))
      .orderBy(asc(comments.createdAt))
      .limit(pageSize)
      .offset(offsetOf(page, pageSize));
    return paginated(
      await this.toViews(
        rows.map((row) => row.comment),
        membership,
        userId,
      ),
      rows[0]?.total ?? 0,
      page,
      pageSize,
    );
  }

  private async add(
    membership: Membership,
    userId: string,
    body: string,
    target: Target,
  ): Promise<CommentView> {
    const [comment] = await this.db
      .insert(comments)
      .values({
        groupId: membership.groupId,
        authorId: userId,
        body,
        movieId: 'movieId' in target ? target.movieId : null,
        movieNightId: 'movieNightId' in target ? target.movieNightId : null,
      })
      .returning();
    await this.notifyMentions(membership, userId, body, target, comment!.id);
    return (await this.toViews([comment!], membership, userId))[0]!;
  }

  private async notifyMentions(
    membership: Membership,
    authorId: string,
    body: string,
    target: Target,
    commentId: string,
  ): Promise<void> {
    const usernames = extractMentions(body);
    if (usernames.length === 0) return;
    // Only members of this group can be mentioned.
    const mentioned = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .innerJoin(groupMembers, eq(groupMembers.userId, profiles.id))
      .where(
        and(eq(groupMembers.groupId, membership.groupId), inArray(profiles.username, usernames)),
      );
    await this.notifications.notify({
      recipientIds: mentioned.map((m) => m.id),
      actorId: authorId,
      type: 'comment_mention',
      title: `${await this.directory.displayNameOf(authorId)} mentioned you in ${membership.groupName}`,
      body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
      data: {
        groupId: membership.groupId,
        commentId,
        ...('tmdbId' in target ? { tmdbId: target.tmdbId } : {}),
        ...('movieNightId' in target ? { movieNightId: target.movieNightId } : {}),
      },
    });
  }

  private async movieNightMembership(
    movieNightId: string,
    userId: string,
    allowArchived: boolean,
  ): Promise<Membership> {
    const [night] = await this.db
      .select({ groupId: movieNights.groupId })
      .from(movieNights)
      .where(eq(movieNights.id, movieNightId));
    if (!night) throw notFound('MOVIE_NIGHT_NOT_FOUND', 'Movie night not found.');
    const membership = await this.access.findMembership(night.groupId, userId);
    if (!membership) throw notFound('MOVIE_NIGHT_NOT_FOUND', 'Movie night not found.');
    if (membership.archived && !allowArchived)
      throw forbidden('GROUP_ARCHIVED', 'This group is archived.');
    return membership;
  }

  private async find(groupId: string, commentId: string): Promise<CommentRow> {
    const [comment] = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.groupId, groupId)));
    if (!comment) throw notFound('COMMENT_NOT_FOUND', 'Comment not found.');
    return comment;
  }

  private async toViews(
    rows: CommentRow[],
    membership: Membership,
    userId: string,
  ): Promise<CommentView[]> {
    const people = await this.directory.people(rows.map((row) => row.authorId));
    return rows.map((row) => ({
      id: row.id,
      author: people.get(row.authorId) ?? {
        id: row.authorId,
        displayName: 'Movie fan',
        username: null,
        avatarUrl: null,
      },
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      edited: row.updatedAt.getTime() - row.createdAt.getTime() > 1000,
      canEdit: row.authorId === userId && !membership.archived,
      canDelete: row.authorId === userId || hasRole(membership.role, 'admin'),
    }));
  }
}
