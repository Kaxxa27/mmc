import { Injectable, Logger } from '@nestjs/common';
import { InjectDb } from '../database/database.constants.js';
import type { Database, DbExecutor } from '../database/database.types.js';
import { auditEvents } from '../database/schema/index.js';

export interface AuditEventInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/** Records security-relevant actions (sign-ins, deletions, ownership changes, ...). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectDb() private readonly db: Database) {}

  async record(event: AuditEventInput, executor: DbExecutor = this.db): Promise<void> {
    try {
      await executor.insert(auditEvents).values({
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        metadata: event.metadata ?? {},
        ipAddress: event.ipAddress ?? null,
      });
    } catch (error) {
      // Inside a transaction the caller's own error handling decides; outside, never break the
      // user's action because the audit insert failed.
      if (executor !== this.db) throw error;
      this.logger.error(
        `Could not record audit event ${event.action}: ${(error as Error).message}`,
      );
    }
  }
}
