import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { isSharedDemoEmail } from '../auth/demo-accounts.js';
import { conflict, forbidden, gone, notFound } from '../common/errors.js';
import { normalizeEmail, randomToken, sha256 } from '../common/utils/crypto.js';
import { addDays } from '../common/utils/dates.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  groupInvitations,
  groupMembers,
  groups,
  profiles,
  type GroupKind,
  type GroupRole,
  type InvitationKind,
} from '../database/schema/index.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateEmailInvitationDto, CreateLinkInvitationDto } from './dto/groups.dto.js';
import { GroupAccessService } from './group-access.service.js';
import { type PersonView, UserDirectoryService } from './user-directory.service.js';

type InvitationRow = typeof groupInvitations.$inferSelect;

export type EffectiveInvitationStatus =
  'pending' | 'accepted' | 'declined' | 'revoked' | 'expired' | 'exhausted';

export interface InvitationView {
  id: string;
  kind: InvitationKind;
  email: string | null;
  role: GroupRole;
  status: EffectiveInvitationStatus;
  expiresAt: Date;
  maxUses: number | null;
  useCount: number;
  invitedBy: PersonView | null;
  createdAt: Date;
}

export interface CreatedLinkInvitation extends InvitationView {
  /** Shown only once: the API stores just a hash of it. */
  token: string;
  url: string;
}

export interface InvitationGroupView {
  id: string;
  name: string;
  kind: GroupKind;
  avatarUrl: string | null;
  memberCount: number;
}

export interface InvitationPreview {
  kind: InvitationKind;
  status: EffectiveInvitationStatus;
  role: GroupRole;
  expiresAt: Date;
  group: InvitationGroupView;
  invitedBy: { displayName: string } | null;
  /** Masked invited address (email invitations only), e.g. `a***@example.com`. */
  emailHint: string | null;
}

export interface MyInvitationView {
  id: string;
  role: GroupRole;
  expiresAt: Date;
  group: InvitationGroupView;
  invitedBy: PersonView | null;
}

export function effectiveStatus(
  invitation: InvitationRow,
  now = new Date(),
): EffectiveInvitationStatus {
  if (invitation.status !== 'pending') return invitation.status;
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) return 'exhausted';
  return 'pending';
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: GroupAccessService,
    private readonly directory: UserDirectoryService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  /** Emails an invitation (re-inviting the same address replaces the previous invitation). */
  async inviteByEmail(
    groupId: string,
    actorId: string,
    dto: CreateEmailInvitationDto,
  ): Promise<InvitationView> {
    const membership = await this.access.require(groupId, actorId, {
      minRole: dto.role === 'admin' ? 'owner' : 'admin',
    });
    // Anyone can use the shared demo accounts; they must not be a way to send email to strangers.
    const [actor] = await this.db
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, actorId));
    if (isSharedDemoEmail(actor?.email)) {
      throw forbidden(
        'DEMO_ACCOUNT_RESTRICTED',
        'Demo accounts cannot send email invitations. Create an invite link instead.',
      );
    }
    const email = normalizeEmail(dto.email);
    const existingUserId = await this.directory.findIdByEmail(email);
    if (existingUserId && (await this.access.findMembership(groupId, existingUserId))) {
      throw conflict('ALREADY_MEMBER', 'This person is already a member of the group.');
    }

    const token = randomToken();
    const expiresAt = addDays(new Date(), dto.expiresInDays ?? this.config.invitations.ttlDays);
    const invitation = await this.db.transaction(async (tx) => {
      await tx
        .update(groupInvitations)
        .set({ status: 'revoked' })
        .where(
          and(
            eq(groupInvitations.groupId, groupId),
            eq(groupInvitations.email, email),
            eq(groupInvitations.status, 'pending'),
          ),
        );
      const [row] = await tx
        .insert(groupInvitations)
        .values({
          groupId,
          kind: 'email',
          email,
          tokenHash: sha256(token),
          role: dto.role ?? 'member',
          invitedBy: actorId,
          expiresAt,
        })
        .returning();
      return row!;
    });

    const inviter = await this.directory.displayNameOf(actorId);
    await this.mail.send(
      email,
      `${inviter} invited you to ${membership.groupName} on My Movie Catalog`,
      {
        heading: `Join ${membership.groupName}`,
        paragraphs: [
          `${inviter} invited you to join "${membership.groupName}" on My Movie Catalog: a shared space to collect movies, rate them together and plan movie nights.`,
          `Accept with this email address. New here? You will create your account in a few seconds, no password needed.`,
          `The invitation expires on ${expiresAt.toUTCString()}.`,
        ],
        action: { label: 'Accept invitation', url: this.inviteUrl(token) },
        footer: 'If you do not know the sender, you can ignore this email.',
      },
    );
    if (existingUserId) {
      await this.notifications.notify({
        recipientIds: [existingUserId],
        actorId,
        type: 'group_invitation',
        title: `${inviter} invited you to ${membership.groupName}`,
        data: { groupId, invitationId: invitation.id },
      });
    }
    await this.audit.record({
      actorId,
      action: 'group.invitation_sent',
      entityType: 'group',
      entityId: groupId,
      metadata: { invitationId: invitation.id, kind: 'email' },
    });
    return (await this.toViews([invitation]))[0]!;
  }

  /** Creates a shareable link. The token is returned once and never stored in clear text. */
  async createLink(
    groupId: string,
    actorId: string,
    dto: CreateLinkInvitationDto,
  ): Promise<CreatedLinkInvitation> {
    await this.access.require(groupId, actorId, {
      minRole: dto.role === 'admin' ? 'owner' : 'admin',
    });
    const token = randomToken();
    const [row] = await this.db
      .insert(groupInvitations)
      .values({
        groupId,
        kind: 'link',
        tokenHash: sha256(token),
        role: dto.role ?? 'member',
        maxUses: dto.maxUses ?? null,
        invitedBy: actorId,
        expiresAt: addDays(new Date(), dto.expiresInDays ?? this.config.invitations.ttlDays),
      })
      .returning();
    await this.audit.record({
      actorId,
      action: 'group.invitation_link_created',
      entityType: 'group',
      entityId: groupId,
      metadata: { invitationId: row!.id },
    });
    const [view] = await this.toViews([row!]);
    return { ...view!, token, url: this.inviteUrl(token) };
  }

  async list(groupId: string, actorId: string): Promise<InvitationView[]> {
    await this.access.require(groupId, actorId, { minRole: 'admin', allowArchived: true });
    const rows = await this.db
      .select()
      .from(groupInvitations)
      .where(eq(groupInvitations.groupId, groupId))
      .orderBy(desc(groupInvitations.createdAt))
      .limit(100);
    return this.toViews(rows);
  }

  async revoke(groupId: string, actorId: string, invitationId: string): Promise<void> {
    await this.access.require(groupId, actorId, { minRole: 'admin', allowArchived: true });
    const updated = await this.db
      .update(groupInvitations)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(groupInvitations.id, invitationId),
          eq(groupInvitations.groupId, groupId),
          eq(groupInvitations.status, 'pending'),
        ),
      )
      .returning({ id: groupInvitations.id });
    if (updated.length === 0)
      throw notFound('INVITATION_NOT_FOUND', 'No pending invitation with this id.');
  }

  /** What an invitation link leads to, so the landing page can show it before sign-in. */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findByToken(token);
    const [group] = await this.groupViews([invitation.groupId]);
    const inviter = invitation.invitedBy
      ? await this.directory.person(invitation.invitedBy)
      : undefined;
    return {
      kind: invitation.kind,
      status: effectiveStatus(invitation),
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      group: group!,
      invitedBy: inviter ? { displayName: inviter.displayName } : null,
      emailHint: invitation.email ? maskEmail(invitation.email) : null,
    };
  }

  async acceptByToken(
    token: string,
    user: AuthUser,
  ): Promise<{ groupId: string; joined: boolean }> {
    const tokenHash = sha256(token);
    return this.accept(user, (tx) =>
      tx
        .select()
        .from(groupInvitations)
        .where(eq(groupInvitations.tokenHash, tokenHash))
        .for('update'),
    );
  }

  /** Accepts an email invitation from the in-app list (`GET /me/invitations`). */
  async acceptById(
    invitationId: string,
    user: AuthUser,
  ): Promise<{ groupId: string; joined: boolean }> {
    return this.accept(user, (tx) =>
      tx
        .select()
        .from(groupInvitations)
        .where(and(eq(groupInvitations.id, invitationId), eq(groupInvitations.kind, 'email')))
        .for('update'),
    );
  }

  async declineById(invitationId: string, user: AuthUser): Promise<void> {
    const updated = await this.db
      .update(groupInvitations)
      .set({ status: 'declined' })
      .where(
        and(
          eq(groupInvitations.id, invitationId),
          eq(groupInvitations.kind, 'email'),
          eq(groupInvitations.email, normalizeEmail(user.email)),
          eq(groupInvitations.status, 'pending'),
        ),
      )
      .returning({ id: groupInvitations.id });
    if (updated.length === 0) throw notFound('INVITATION_NOT_FOUND', 'Invitation not found.');
  }

  /** Pending email invitations addressed to the signed-in user. */
  async listForUser(user: AuthUser): Promise<MyInvitationView[]> {
    const rows = await this.db
      .select()
      .from(groupInvitations)
      .where(
        and(
          eq(groupInvitations.kind, 'email'),
          eq(groupInvitations.email, normalizeEmail(user.email)),
          eq(groupInvitations.status, 'pending'),
          gt(groupInvitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(groupInvitations.createdAt));
    const groupViews = new Map(
      (await this.groupViews(rows.map((r) => r.groupId))).map((g) => [g.id, g]),
    );
    const people = await this.directory.people(
      rows.flatMap((r) => (r.invitedBy ? [r.invitedBy] : [])),
    );
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      expiresAt: row.expiresAt,
      group: groupViews.get(row.groupId)!,
      invitedBy: row.invitedBy ? (people.get(row.invitedBy) ?? null) : null,
    }));
  }

  private async accept(
    user: AuthUser,
    load: (tx: Transaction) => Promise<InvitationRow[]>,
  ): Promise<{ groupId: string; joined: boolean }> {
    const result = await this.db.transaction(async (tx) => {
      const [invitation] = await load(tx);
      if (!invitation) throw notFound('INVITATION_NOT_FOUND', 'Invitation not found.');

      const status = effectiveStatus(invitation);
      if (status === 'expired')
        throw gone('INVITATION_EXPIRED', 'This invitation has expired. Ask for a new one.');
      if (status === 'revoked') throw gone('INVITATION_REVOKED', 'This invitation was withdrawn.');
      if (invitation.kind === 'email' && normalizeEmail(user.email) !== invitation.email) {
        throw forbidden(
          'INVITATION_EMAIL_MISMATCH',
          'This invitation was sent to a different email address. Sign in with that address to accept it.',
        );
      }

      const existing = await this.access.findMembership(invitation.groupId, user.id, tx);
      if (existing) {
        if (invitation.kind === 'email' && status === 'pending') {
          await tx
            .update(groupInvitations)
            .set({ status: 'accepted', acceptedBy: user.id, acceptedAt: new Date() })
            .where(eq(groupInvitations.id, invitation.id));
        }
        return { groupId: invitation.groupId, joined: false };
      }
      if (status !== 'pending') {
        throw gone('INVITATION_USED', 'This invitation can no longer be used.');
      }
      const [group] = await tx
        .select({ archivedAt: groups.archivedAt })
        .from(groups)
        .where(eq(groups.id, invitation.groupId));
      if (group?.archivedAt) throw forbidden('GROUP_ARCHIVED', 'This group is archived.');

      await tx
        .insert(groupMembers)
        .values({ groupId: invitation.groupId, userId: user.id, role: invitation.role });
      await tx
        .update(groupInvitations)
        .set(
          invitation.kind === 'email'
            ? { status: 'accepted', acceptedBy: user.id, acceptedAt: new Date() }
            : { useCount: sql`${groupInvitations.useCount} + 1` },
        )
        .where(eq(groupInvitations.id, invitation.id));
      await this.audit.record(
        {
          actorId: user.id,
          action: 'group.member_joined',
          entityType: 'group',
          entityId: invitation.groupId,
          metadata: { invitationId: invitation.id, kind: invitation.kind },
        },
        tx,
      );
      return { groupId: invitation.groupId, joined: true };
    });

    if (result.joined) {
      const [name, memberIds, groupView] = await Promise.all([
        this.directory.displayNameOf(user.id),
        this.access.memberIds(result.groupId),
        this.groupViews([result.groupId]),
      ]);
      await this.notifications.notify({
        recipientIds: memberIds,
        actorId: user.id,
        type: 'group_member_joined',
        title: `${name} joined ${groupView[0]?.name ?? 'your group'}`,
        data: { groupId: result.groupId, userId: user.id },
      });
    }
    return result;
  }

  private async findByToken(token: string): Promise<InvitationRow> {
    const [invitation] = await this.db
      .select()
      .from(groupInvitations)
      .where(eq(groupInvitations.tokenHash, sha256(token)));
    if (!invitation) throw notFound('INVITATION_NOT_FOUND', 'Invitation not found.');
    return invitation;
  }

  private async groupViews(groupIds: string[]): Promise<InvitationGroupView[]> {
    if (groupIds.length === 0) return [];
    const rows = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        kind: groups.kind,
        avatarUrl: groups.avatarUrl,
        memberCount:
          sql<number>`(select count(*) from ${groupMembers} gm where gm.group_id = ${groups.id})`.mapWith(
            Number,
          ),
      })
      .from(groups)
      .where(inArray(groups.id, [...new Set(groupIds)]));
    return rows;
  }

  private async toViews(rows: InvitationRow[]): Promise<InvitationView[]> {
    const people = await this.directory.people(
      rows.flatMap((r) => (r.invitedBy ? [r.invitedBy] : [])),
    );
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      email: row.email,
      role: row.role,
      status: effectiveStatus(row),
      expiresAt: row.expiresAt,
      maxUses: row.maxUses,
      useCount: row.useCount,
      invitedBy: row.invitedBy ? (people.get(row.invitedBy) ?? null) : null,
      createdAt: row.createdAt,
    }));
  }

  private inviteUrl(token: string): string {
    return `${this.config.http.webAppUrl}/invitations/${encodeURIComponent(token)}`;
  }
}
