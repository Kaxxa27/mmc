import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { forbidden, notFound } from '../common/errors.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database, DbExecutor } from '../database/database.types.js';
import { groupMembers, groups, type GroupRole } from '../database/schema/index.js';

const ROLE_RANK: Record<GroupRole, number> = { member: 1, admin: 2, owner: 3 };

export interface Membership {
  groupId: string;
  userId: string;
  role: GroupRole;
  groupName: string;
  archived: boolean;
}

export function hasRole(role: GroupRole, minimum: GroupRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Membership checks shared by every group feature. Non-members get "not found" so the API
 * never confirms that a group exists to people outside it.
 */
@Injectable()
export class GroupAccessService {
  constructor(@InjectDb() private readonly db: Database) {}

  async findMembership(
    groupId: string,
    userId: string,
    executor: DbExecutor = this.db,
  ): Promise<Membership | undefined> {
    const [row] = await executor
      .select({
        groupId: groupMembers.groupId,
        userId: groupMembers.userId,
        role: groupMembers.role,
        groupName: groups.name,
        archivedAt: groups.archivedAt,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    if (!row) return undefined;
    const { archivedAt, ...membership } = row;
    return { ...membership, archived: archivedAt !== null };
  }

  /**
   * Throws 404 for non-members and 403 when the member's role is too low.
   * Archived groups are read-only unless `allowArchived` is set.
   */
  async require(
    groupId: string,
    userId: string,
    options: { minRole?: GroupRole; allowArchived?: boolean; executor?: DbExecutor } = {},
  ): Promise<Membership> {
    const membership = await this.findMembership(groupId, userId, options.executor);
    if (!membership) throw notFound('GROUP_NOT_FOUND', 'Group not found.');
    if (options.minRole && !hasRole(membership.role, options.minRole)) {
      throw forbidden(
        'GROUP_PERMISSION_DENIED',
        `This action requires the ${options.minRole} role.`,
      );
    }
    if (membership.archived && !options.allowArchived) {
      throw forbidden('GROUP_ARCHIVED', 'This group is archived. Restore it to make changes.');
    }
    return membership;
  }

  async memberIds(groupId: string, executor: DbExecutor = this.db): Promise<string[]> {
    const rows = await executor
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    return rows.map((row) => row.userId);
  }

  /** Ids of the active (non-archived) groups the user belongs to. */
  async activeGroupIdsOf(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.userId, userId), isNull(groups.archivedAt)));
    return rows.map((row) => row.groupId);
  }
}
