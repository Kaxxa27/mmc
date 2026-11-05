import { Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { offsetOf, type Paginated, paginated } from '../common/dto/pagination.dto.js';
import { notFound } from '../common/errors.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { notifications, profiles, type NotificationType } from '../database/schema/index.js';
import type { EmailContent } from '../mail/email-layout.js';
import { MailService } from '../mail/mail.service.js';
import {
  effectivePreferences,
  type EffectivePreference,
  isEnabled,
  mergePreferences,
} from './notification-preferences.js';

export interface NotifyInput {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Same key + recipient = notification is created only once. */
  dedupeKey?: string;
  /** Usually the user who triggered the event; never notified about their own action. */
  actorId?: string;
  /** Sent to recipients who enabled email for this type. */
  email?: { subject: string; content: EmailContent };
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly mail: MailService,
  ) {}

  /** Creates in-app notifications and sends optional emails. Never throws. */
  async notify(input: NotifyInput): Promise<void> {
    const recipientIds = [...new Set(input.recipientIds)].filter((id) => id !== input.actorId);
    if (recipientIds.length === 0) return;
    try {
      const recipients = await this.db
        .select({
          id: profiles.id,
          email: profiles.email,
          preferences: profiles.notificationPreferences,
        })
        .from(profiles)
        .where(inArray(profiles.id, recipientIds));

      const inApp = recipients.filter((r) => isEnabled(r.preferences, input.type, 'inApp'));
      if (inApp.length > 0) {
        await this.db
          .insert(notifications)
          .values(
            inApp.map((r) => ({
              userId: r.id,
              type: input.type,
              title: input.title,
              body: input.body ?? null,
              data: input.data ?? {},
              dedupeKey: input.dedupeKey ?? null,
            })),
          )
          .onConflictDoNothing();
      }

      const email = input.email;
      if (email) {
        const emailRecipients = recipients.filter(
          (r) => r.email && isEnabled(r.preferences, input.type, 'email'),
        );
        await Promise.all(
          emailRecipients.map((r) => this.mail.send(r.email, email.subject, email.content)),
        );
      }
    } catch (error) {
      this.logger.error(
        `Could not deliver ${input.type} notification: ${(error as Error).message}`,
      );
    }
  }

  async list(
    userId: string,
    options: { unreadOnly: boolean; page: number; pageSize: number },
  ): Promise<Paginated<NotificationView> & { unreadCount: number }> {
    const filter = options.unreadOnly
      ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
      : eq(notifications.userId, userId);
    const rows = await this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        data: notifications.data,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(notifications)
      .where(filter)
      .orderBy(desc(notifications.createdAt))
      .limit(options.pageSize)
      .offset(offsetOf(options.page, options.pageSize));
    const unreadCount = await this.unreadCount(userId);
    const total = rows[0]?.total ?? (await this.count(filter));
    return {
      ...paginated(
        rows.map(({ total: _total, ...item }) => item),
        total,
        options.page,
        options.pageSize,
      ),
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.count(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    if (updated.length === 0) throw notFound('NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return updated.length;
  }

  async remove(userId: string, notificationId: string): Promise<void> {
    const deleted = await this.db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    if (deleted.length === 0) throw notFound('NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }

  async getPreferences(userId: string): Promise<EffectivePreference[]> {
    const [row] = await this.db
      .select({ preferences: profiles.notificationPreferences })
      .from(profiles)
      .where(eq(profiles.id, userId));
    return effectivePreferences(row?.preferences);
  }

  async updatePreferences(
    userId: string,
    updates: { type: NotificationType; inApp?: boolean; email?: boolean }[],
  ): Promise<EffectivePreference[]> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ preferences: profiles.notificationPreferences })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .for('update');
      const merged = mergePreferences(row?.preferences, updates);
      await tx
        .update(profiles)
        .set({ notificationPreferences: merged })
        .where(eq(profiles.id, userId));
      return effectivePreferences(merged);
    });
  }

  private async count(filter: ReturnType<typeof and>): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(notifications).where(filter);
    return row?.value ?? 0;
  }
}
