import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, exists, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { offsetOf, type Paginated, paginated } from '../common/dto/pagination.dto.js';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { displayName } from '../common/utils/display-name.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { isUniqueViolation } from '../database/pg-errors.js';
import {
  collectionItems,
  collections,
  collectionShares,
  groupMembers,
  groups,
  movies,
  profiles,
} from '../database/schema/index.js';
import { GroupAccessService, hasRole, type Membership } from '../groups/group-access.service.js';
import { MediaService, type UploadedImage } from '../media/media.service.js';
import { MovieStore } from '../movies/movie-store.service.js';
import { MoviePresenter } from '../movies/movie.presenter.js';
import { UserMovieStateService } from '../movies/user-movie-state.service.js';
import type {
  CollectionDetails,
  CollectionPermissions,
  CollectionShareView,
  CollectionSummary,
  PersonView,
} from './collections.types.js';
import type {
  AddCollectionItemDto,
  CreateCollectionDto,
  ListCollectionsQueryDto,
  ShareCollectionDto,
  UpdateCollectionDto,
} from './dto/collections.dto.js';

type CollectionRow = typeof collections.$inferSelect;

const MAX_ITEMS = 1000;

const personColumns = (table: typeof profiles) => ({
  id: table.id,
  firstName: table.firstName,
  lastName: table.lastName,
  username: table.username,
  avatarUrl: table.avatarUrl,
});

type PersonRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

const toPerson = (row: PersonRow): PersonView => ({
  id: row.id,
  displayName: displayName(row),
  avatarUrl: row.avatarUrl,
});

@Injectable()
export class CollectionsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly groupAccess: GroupAccessService,
    private readonly store: MovieStore,
    private readonly presenter: MoviePresenter,
    private readonly userStates: UserMovieStateService,
    private readonly media: MediaService,
  ) {}

  async list(
    userId: string,
    query: ListCollectionsQueryDto,
  ): Promise<Paginated<CollectionSummary>> {
    let where: SQL;
    let permissions: (row: CollectionRow) => CollectionPermissions;
    if (query.scope === 'group') {
      const membership = await this.groupAccess.require(query.groupId!, userId, {
        allowArchived: true,
      });
      where = eq(collections.groupId, membership.groupId);
      permissions = (row) => this.groupPermissions(row, userId, membership);
    } else if (query.scope === 'shared') {
      where = and(
        isNull(collections.groupId),
        eq(collections.visibility, 'shared'),
        ne(collections.ownerId, userId),
        exists(
          this.db
            .select({ one: sql`1` })
            .from(collectionShares)
            .where(
              and(
                eq(collectionShares.collectionId, collections.id),
                or(
                  eq(collectionShares.userId, userId),
                  exists(
                    this.db
                      .select({ one: sql`1` })
                      .from(groupMembers)
                      .where(
                        and(
                          eq(groupMembers.groupId, collectionShares.groupId),
                          eq(groupMembers.userId, userId),
                        ),
                      ),
                  ),
                ),
              ),
            ),
        ),
      ) as SQL;
      permissions = () => ({ canEdit: false, canManage: false });
    } else {
      where = and(eq(collections.ownerId, userId), isNull(collections.groupId)) as SQL;
      permissions = () => ({ canEdit: true, canManage: true });
    }

    const rows = await this.summaryQuery(where)
      .orderBy(desc(collections.updatedAt))
      .limit(query.pageSize)
      .offset(offsetOf(query.page, query.pageSize));
    return paginated(
      rows.map((row) => this.toSummary(row, permissions(row.collection))),
      rows[0]?.total ?? 0,
      query.page,
      query.pageSize,
    );
  }

  async create(userId: string, dto: CreateCollectionDto): Promise<CollectionDetails> {
    if (dto.groupId) {
      await this.groupAccess.require(dto.groupId, userId);
      if (dto.visibility === 'private') {
        throw badRequest(
          'INVALID_VISIBILITY',
          'Group collections are visible to the group: use shared or public.',
        );
      }
    }
    const [row] = await this.db
      .insert(collections)
      .values({
        ownerId: userId,
        groupId: dto.groupId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
        visibility: dto.visibility ?? (dto.groupId ? 'shared' : 'private'),
      })
      .returning({ id: collections.id });
    return this.get(row!.id, userId);
  }

  /** Viewable by the owner, group members, people it is shared with, or anyone if public. */
  async get(collectionId: string, userId: string | undefined): Promise<CollectionDetails> {
    const { permissions } = await this.resolve(collectionId, userId);
    const [summary] = await this.summaryQuery(eq(collections.id, collectionId));
    if (!summary) throw notFound('COLLECTION_NOT_FOUND', 'Collection not found.');

    const addedBy = alias(profiles, 'added_by');
    const rows = await this.db
      .select({
        item: collectionItems,
        movie: movies,
        addedBy: {
          id: addedBy.id,
          firstName: addedBy.firstName,
          lastName: addedBy.lastName,
          username: addedBy.username,
          avatarUrl: addedBy.avatarUrl,
        },
      })
      .from(collectionItems)
      .innerJoin(movies, eq(movies.id, collectionItems.movieId))
      .leftJoin(addedBy, eq(addedBy.id, collectionItems.addedBy))
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(asc(collectionItems.position), asc(collectionItems.addedAt))
      .limit(MAX_ITEMS);
    const movieSummaries = await this.userStates.annotate(
      userId,
      rows.map((row) => ({ ...this.presenter.fromRow(row.movie), runtime: row.movie.runtime })),
    );
    return {
      ...this.toSummary(summary, permissions),
      items: rows.map((row, index) => ({
        movie: movieSummaries[index]!,
        note: row.item.note,
        position: row.item.position,
        addedAt: row.item.addedAt,
        addedBy: row.addedBy ? toPerson(row.addedBy) : null,
      })),
    };
  }

  async update(
    collectionId: string,
    userId: string,
    dto: UpdateCollectionDto,
  ): Promise<CollectionDetails> {
    const { row } = await this.resolve(collectionId, userId, 'manage');
    if (row.groupId && dto.visibility === 'private') {
      throw badRequest(
        'INVALID_VISIBILITY',
        'Group collections are visible to the group: use shared or public.',
      );
    }
    await this.db
      .update(collections)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        updatedAt: new Date(),
      })
      .where(eq(collections.id, collectionId));
    if (dto.coverImageUrl !== undefined && dto.coverImageUrl !== row.coverImageUrl) {
      await this.media.removeByUrl(row.coverImageUrl);
    }
    return this.get(collectionId, userId);
  }

  async remove(collectionId: string, userId: string): Promise<void> {
    const { row } = await this.resolve(collectionId, userId, 'manage');
    await this.db.delete(collections).where(eq(collections.id, collectionId));
    await this.media.removeByUrl(row.coverImageUrl);
  }

  async setCover(
    collectionId: string,
    userId: string,
    file: UploadedImage | undefined,
  ): Promise<CollectionDetails> {
    const { row } = await this.resolve(collectionId, userId, 'manage');
    const url = await this.media.uploadImage(`collections/${collectionId}`, file);
    await this.db
      .update(collections)
      .set({ coverImageUrl: url })
      .where(eq(collections.id, collectionId));
    await this.media.removeByUrl(row.coverImageUrl);
    return this.get(collectionId, userId);
  }

  async addItem(
    collectionId: string,
    userId: string,
    dto: AddCollectionItemDto,
  ): Promise<CollectionDetails> {
    await this.resolve(collectionId, userId, 'edit');
    const movie = await this.store.ensure(dto.tmdbId);
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .select({ id: collections.id })
          .from(collections)
          .where(eq(collections.id, collectionId))
          .for('update');
        const [{ count = 0 } = {}] = await tx
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(collectionItems)
          .where(eq(collectionItems.collectionId, collectionId));
        if (count >= MAX_ITEMS) {
          throw badRequest('COLLECTION_FULL', `A collection can hold up to ${MAX_ITEMS} movies.`);
        }
        await tx.insert(collectionItems).values({
          collectionId,
          movieId: movie.id,
          note: dto.note ?? null,
          addedBy: userId,
          position: sql`(select coalesce(max(${collectionItems.position}), -1) + 1 from ${collectionItems} where ${collectionItems.collectionId} = ${collectionId})`,
        });
        await tx
          .update(collections)
          .set({ updatedAt: new Date() })
          .where(eq(collections.id, collectionId));
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('ALREADY_IN_COLLECTION', 'This movie is already in the collection.');
      }
      throw error;
    }
    return this.get(collectionId, userId);
  }

  async removeItem(collectionId: string, userId: string, tmdbId: number): Promise<void> {
    await this.resolve(collectionId, userId, 'edit');
    const movie = await this.store.findByTmdbId(tmdbId);
    const deleted = movie
      ? await this.db
          .delete(collectionItems)
          .where(
            and(
              eq(collectionItems.collectionId, collectionId),
              eq(collectionItems.movieId, movie.id),
            ),
          )
          .returning({ movieId: collectionItems.movieId })
      : [];
    if (deleted.length === 0)
      throw notFound('NOT_IN_COLLECTION', 'This movie is not in the collection.');
    await this.db
      .update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, collectionId));
  }

  async reorder(
    collectionId: string,
    userId: string,
    tmdbIds: number[],
  ): Promise<CollectionDetails> {
    await this.resolve(collectionId, userId, 'edit');
    await this.db.transaction(async (tx) => {
      const items = await tx
        .select({ movieId: collectionItems.movieId, tmdbId: movies.tmdbId })
        .from(collectionItems)
        .innerJoin(movies, eq(movies.id, collectionItems.movieId))
        .where(eq(collectionItems.collectionId, collectionId))
        .orderBy(asc(collectionItems.position), asc(collectionItems.addedAt))
        .for('update', { of: collectionItems });
      const byTmdbId = new Map(items.map((item) => [item.tmdbId, item]));
      const listed = tmdbIds.map((id) => byTmdbId.get(id)).filter((item) => item !== undefined);
      const listedIds = new Set(listed.map((item) => item.movieId));
      const ordered = [...listed, ...items.filter((item) => !listedIds.has(item.movieId))];
      for (const [position, item] of ordered.entries()) {
        await tx
          .update(collectionItems)
          .set({ position })
          .where(
            and(
              eq(collectionItems.collectionId, collectionId),
              eq(collectionItems.movieId, item.movieId),
            ),
          );
      }
      await tx
        .update(collections)
        .set({ updatedAt: new Date() })
        .where(eq(collections.id, collectionId));
    });
    return this.get(collectionId, userId);
  }

  async listShares(collectionId: string, userId: string): Promise<CollectionShareView[]> {
    await this.resolve(collectionId, userId, 'manage');
    const rows = await this.db
      .select({
        share: collectionShares,
        groupName: groups.name,
        user: personColumns(profiles),
      })
      .from(collectionShares)
      .leftJoin(groups, eq(groups.id, collectionShares.groupId))
      .leftJoin(profiles, eq(profiles.id, collectionShares.userId))
      .where(eq(collectionShares.collectionId, collectionId))
      .orderBy(asc(collectionShares.createdAt));
    return rows.map((row) => ({
      id: row.share.id,
      group: row.share.groupId ? { id: row.share.groupId, name: row.groupName ?? '' } : null,
      user: row.share.userId && row.user ? toPerson(row.user) : null,
      createdAt: row.share.createdAt,
    }));
  }

  /** Shares a personal collection with a group or a person (switches it to `shared`). */
  async share(
    collectionId: string,
    userId: string,
    dto: ShareCollectionDto,
  ): Promise<CollectionShareView[]> {
    const { row } = await this.resolve(collectionId, userId, 'manage');
    if (row.groupId) {
      throw badRequest(
        'GROUP_COLLECTION',
        'Group collections are already shared with the whole group.',
      );
    }
    let target: { groupId: string } | { userId: string };
    if (dto.groupId) {
      await this.groupAccess.require(dto.groupId, userId, { allowArchived: true });
      target = { groupId: dto.groupId };
    } else {
      const [person] = await this.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.username, dto.username!));
      if (!person) throw notFound('USER_NOT_FOUND', 'No user with this username.');
      if (person.id === userId)
        throw badRequest('CANNOT_SHARE_WITH_SELF', 'You already own this collection.');
      target = { userId: person.id };
    }
    try {
      await this.db.insert(collectionShares).values({ collectionId, ...target });
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict('ALREADY_SHARED', 'The collection is already shared with them.');
      throw error;
    }
    if (row.visibility === 'private') {
      await this.db
        .update(collections)
        .set({ visibility: 'shared' })
        .where(eq(collections.id, collectionId));
    }
    return this.listShares(collectionId, userId);
  }

  async unshare(collectionId: string, userId: string, shareId: string): Promise<void> {
    await this.resolve(collectionId, userId, 'manage');
    const deleted = await this.db
      .delete(collectionShares)
      .where(and(eq(collectionShares.id, shareId), eq(collectionShares.collectionId, collectionId)))
      .returning({ id: collectionShares.id });
    if (deleted.length === 0) throw notFound('SHARE_NOT_FOUND', 'Share not found.');
  }

  private async resolve(
    collectionId: string,
    userId: string | undefined,
    required: 'view' | 'edit' | 'manage' = 'view',
  ): Promise<{ row: CollectionRow; permissions: CollectionPermissions }> {
    const [row] = await this.db.select().from(collections).where(eq(collections.id, collectionId));
    if (!row) throw notFound('COLLECTION_NOT_FOUND', 'Collection not found.');

    let canView = row.visibility === 'public';
    let permissions: CollectionPermissions = { canEdit: false, canManage: false };
    if (userId) {
      if (row.groupId) {
        const membership = await this.groupAccess.findMembership(row.groupId, userId);
        if (membership) {
          canView = true;
          permissions = this.groupPermissions(row, userId, membership);
        }
      } else if (row.ownerId === userId) {
        canView = true;
        permissions = { canEdit: true, canManage: true };
      } else if (row.visibility === 'shared' && (await this.isSharedWith(row.id, userId))) {
        canView = true;
      }
    }
    if (!canView) throw notFound('COLLECTION_NOT_FOUND', 'Collection not found.');
    if (required === 'edit' && !permissions.canEdit) {
      throw notFound('COLLECTION_NOT_FOUND', 'Collection not found.');
    }
    if (required === 'manage' && !permissions.canManage) {
      throw notFound('COLLECTION_NOT_FOUND', 'Collection not found.');
    }
    return { row, permissions };
  }

  private groupPermissions(
    row: CollectionRow,
    userId: string,
    membership: Membership,
  ): CollectionPermissions {
    if (membership.archived) return { canEdit: false, canManage: false };
    return {
      canEdit: true,
      canManage: row.ownerId === userId || hasRole(membership.role, 'admin'),
    };
  }

  private async isSharedWith(collectionId: string, userId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      select 1 from ${collectionShares} s
      where s.collection_id = ${collectionId}
        and (s.user_id = ${userId}
          or exists (select 1 from ${groupMembers} gm where gm.group_id = s.group_id and gm.user_id = ${userId}))
      limit 1
    `);
    return result.rows.length > 0;
  }

  private summaryQuery(where: SQL | undefined) {
    return this.db
      .select({
        collection: collections,
        owner: personColumns(profiles),
        groupName: groups.name,
        itemCount:
          sql<number>`(select count(*) from ${collectionItems} ci where ci.collection_id = ${collections.id})`.mapWith(
            Number,
          ),
        firstPoster: sql<
          string | null
        >`(select m.poster_path from ${collectionItems} ci join ${movies} m on m.id = ci.movie_id where ci.collection_id = ${collections.id} order by ci.position, ci.added_at limit 1)`,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(collections)
      .innerJoin(profiles, eq(profiles.id, collections.ownerId))
      .leftJoin(groups, eq(groups.id, collections.groupId))
      .where(where)
      .$dynamic();
  }

  private toSummary(
    row: {
      collection: CollectionRow;
      owner: PersonRow;
      groupName: string | null;
      itemCount: number;
      firstPoster: string | null;
    },
    permissions: CollectionPermissions,
  ): CollectionSummary {
    const { collection } = row;
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImageUrl: collection.coverImageUrl ?? this.presenter.image(row.firstPoster, 'w500'),
      visibility: collection.visibility,
      group: collection.groupId ? { id: collection.groupId, name: row.groupName ?? '' } : null,
      owner: toPerson(row.owner),
      itemCount: row.itemCount,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      permissions,
    };
  }
}
