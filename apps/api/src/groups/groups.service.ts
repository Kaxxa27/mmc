import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { groupMembers, groupMovies, groups, type GroupRole } from '../database/schema/index.js';
import { MediaService, type UploadedImage } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateGroupDto, UpdateGroupDto } from './dto/groups.dto.js';
import { GroupAccessService } from './group-access.service.js';
import type { GroupDetails, GroupSummary, MemberView } from './groups.types.js';
import { UserDirectoryService } from './user-directory.service.js';

type GroupRow = typeof groups.$inferSelect;

@Injectable()
export class GroupsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: GroupAccessService,
    private readonly directory: UserDirectoryService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  async listMine(userId: string, includeArchived = false): Promise<GroupSummary[]> {
    const rows = await this.db
      .select({ group: groups, role: groupMembers.role, ...this.countColumns() })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(
        includeArchived
          ? eq(groupMembers.userId, userId)
          : and(eq(groupMembers.userId, userId), isNull(groups.archivedAt)),
      )
      .orderBy(asc(groups.name));
    return rows.map((row) => this.toSummary(row.group, row.role, row.memberCount, row.movieCount));
  }

  async create(userId: string, dto: CreateGroupDto): Promise<GroupDetails> {
    const groupId = await this.db.transaction(async (tx) => {
      const [group] = await tx
        .insert(groups)
        .values({
          name: dto.name,
          description: dto.description ?? null,
          kind: dto.kind ?? 'family',
          avatarUrl: dto.avatarUrl ?? null,
          ownerId: userId,
        })
        .returning({ id: groups.id });
      await tx.insert(groupMembers).values({ groupId: group!.id, userId, role: 'owner' });
      await this.audit.record(
        { actorId: userId, action: 'group.created', entityType: 'group', entityId: group!.id },
        tx,
      );
      return group!.id;
    });
    return this.get(groupId, userId);
  }

  async get(groupId: string, userId: string): Promise<GroupDetails> {
    const membership = await this.access.require(groupId, userId, { allowArchived: true });
    const [row] = await this.db
      .select({ group: groups, ...this.countColumns() })
      .from(groups)
      .where(eq(groups.id, groupId));
    if (!row) throw notFound('GROUP_NOT_FOUND', 'Group not found.');
    return {
      ...this.toSummary(row.group, membership.role, row.memberCount, row.movieCount),
      members: await this.members(groupId),
    };
  }

  async update(groupId: string, userId: string, dto: UpdateGroupDto): Promise<GroupDetails> {
    await this.access.require(groupId, userId, { minRole: 'admin' });
    const [before] = await this.db.select().from(groups).where(eq(groups.id, groupId));
    await this.db
      .update(groups)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      })
      .where(eq(groups.id, groupId));
    if (dto.avatarUrl !== undefined && before?.avatarUrl !== dto.avatarUrl) {
      await this.media.removeByUrl(before?.avatarUrl);
    }
    return this.get(groupId, userId);
  }

  async setAvatar(
    groupId: string,
    userId: string,
    file: UploadedImage | undefined,
  ): Promise<GroupDetails> {
    await this.access.require(groupId, userId, { minRole: 'admin' });
    const [before] = await this.db.select().from(groups).where(eq(groups.id, groupId));
    const url = await this.media.uploadImage(`groups/${groupId}`, file);
    await this.db.update(groups).set({ avatarUrl: url }).where(eq(groups.id, groupId));
    await this.media.removeByUrl(before?.avatarUrl);
    return this.get(groupId, userId);
  }

  /** Archived groups stay readable but cannot be changed. */
  async setArchived(groupId: string, userId: string, archived: boolean): Promise<GroupDetails> {
    await this.access.require(groupId, userId, { minRole: 'owner', allowArchived: true });
    await this.db
      .update(groups)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(groups.id, groupId));
    await this.audit.record({
      actorId: userId,
      action: archived ? 'group.archived' : 'group.restored',
      entityType: 'group',
      entityId: groupId,
    });
    return this.get(groupId, userId);
  }

  async remove(groupId: string, userId: string): Promise<void> {
    const membership = await this.access.require(groupId, userId, {
      minRole: 'owner',
      allowArchived: true,
    });
    const [group] = await this.db.delete(groups).where(eq(groups.id, groupId)).returning();
    await this.audit.record({
      actorId: userId,
      action: 'group.deleted',
      entityType: 'group',
      entityId: groupId,
      metadata: { name: membership.groupName },
    });
    await this.media.removeByUrl(group?.avatarUrl);
  }

  async members(groupId: string): Promise<MemberView[]> {
    const rows = await this.db
      .select({
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
      })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(
        sql`case ${groupMembers.role} when 'owner' then 0 when 'admin' then 1 else 2 end`,
        asc(groupMembers.joinedAt),
      );
    const people = await this.directory.people(rows.map((row) => row.userId));
    return rows.map((row) => ({
      ...(people.get(row.userId) ?? {
        id: row.userId,
        displayName: 'Movie fan',
        username: null,
        avatarUrl: null,
      }),
      role: row.role,
      joinedAt: row.joinedAt,
    }));
  }

  async listMembers(groupId: string, userId: string): Promise<MemberView[]> {
    await this.access.require(groupId, userId, { allowArchived: true });
    return this.members(groupId);
  }

  /** Owner only: promote a member to admin or demote an admin. */
  async changeRole(
    groupId: string,
    actorId: string,
    targetId: string,
    role: 'admin' | 'member',
  ): Promise<MemberView[]> {
    const membership = await this.access.require(groupId, actorId, { minRole: 'owner' });
    const target = await this.access.findMembership(groupId, targetId);
    if (!target) throw notFound('MEMBER_NOT_FOUND', 'This person is not a member of the group.');
    if (target.role === 'owner') {
      throw badRequest('CANNOT_CHANGE_OWNER_ROLE', 'Transfer ownership to change the owner.');
    }
    if (target.role !== role) {
      await this.db
        .update(groupMembers)
        .set({ role })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
      await this.audit.record({
        actorId,
        action: 'group.member_role_changed',
        entityType: 'group',
        entityId: groupId,
        metadata: { userId: targetId, role },
      });
      await this.notifications.notify({
        recipientIds: [targetId],
        type: 'group_role_changed',
        title:
          role === 'admin'
            ? `You are now an admin of ${membership.groupName}`
            : `You are now a member of ${membership.groupName}`,
        data: { groupId, role },
      });
    }
    return this.members(groupId);
  }

  /** Owners can remove anyone; admins can remove regular members. */
  async removeMember(groupId: string, actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) {
      throw badRequest('USE_LEAVE', 'Use POST /groups/{groupId}/leave to leave a group.');
    }
    const actor = await this.access.require(groupId, actorId, { minRole: 'admin' });
    const target = await this.access.findMembership(groupId, targetId);
    if (!target) throw notFound('MEMBER_NOT_FOUND', 'This person is not a member of the group.');
    if (target.role === 'owner' || (target.role === 'admin' && actor.role !== 'owner')) {
      throw forbidden('GROUP_PERMISSION_DENIED', 'You cannot remove this member.');
    }
    await this.db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
    await this.audit.record({
      actorId,
      action: 'group.member_removed',
      entityType: 'group',
      entityId: groupId,
      metadata: { userId: targetId },
    });
  }

  async leave(groupId: string, userId: string): Promise<void> {
    const membership = await this.access.require(groupId, userId, { allowArchived: true });
    if (membership.role === 'owner') {
      throw conflict(
        'OWNER_CANNOT_LEAVE',
        'Transfer ownership to another member or delete the group before leaving.',
      );
    }
    await this.db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  }

  /** Makes another member the owner; the previous owner becomes an admin. */
  async transferOwnership(
    groupId: string,
    ownerId: string,
    newOwnerId: string,
  ): Promise<GroupDetails> {
    const membership = await this.access.require(groupId, ownerId, { minRole: 'owner' });
    if (newOwnerId === ownerId) throw badRequest('ALREADY_OWNER', 'You already own this group.');
    const target = await this.access.findMembership(groupId, newOwnerId);
    if (!target) throw notFound('MEMBER_NOT_FOUND', 'This person is not a member of the group.');
    await this.db.transaction(async (tx) => {
      await tx
        .update(groupMembers)
        .set({ role: 'admin' })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, ownerId)));
      await tx
        .update(groupMembers)
        .set({ role: 'owner' })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, newOwnerId)));
      await tx.update(groups).set({ ownerId: newOwnerId }).where(eq(groups.id, groupId));
      await this.audit.record(
        {
          actorId: ownerId,
          action: 'group.ownership_transferred',
          entityType: 'group',
          entityId: groupId,
          metadata: { from: ownerId, to: newOwnerId },
        },
        tx,
      );
    });
    await this.notifications.notify({
      recipientIds: [newOwnerId],
      type: 'group_role_changed',
      title: `You are now the owner of ${membership.groupName}`,
      data: { groupId, role: 'owner' },
    });
    return this.get(groupId, ownerId);
  }

  private countColumns() {
    return {
      memberCount:
        sql<number>`(select count(*) from ${groupMembers} gm where gm.group_id = ${groups.id})`.mapWith(
          Number,
        ),
      movieCount:
        sql<number>`(select count(*) from ${groupMovies} gmv where gmv.group_id = ${groups.id})`.mapWith(
          Number,
        ),
    };
  }

  private toSummary(
    group: GroupRow,
    role: GroupRole,
    memberCount: number,
    movieCount: number,
  ): GroupSummary {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      kind: group.kind,
      avatarUrl: group.avatarUrl,
      archived: group.archivedAt !== null,
      myRole: role,
      memberCount,
      movieCount,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
