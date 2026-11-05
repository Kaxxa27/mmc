import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, between, eq, sql } from 'drizzle-orm';
import { OtpProtectionService } from '../auth/otp-protection.service.js';
import { addDays, todayIsoDate } from '../common/utils/dates.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { movies, userMovies } from '../database/schema/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { TmdbCacheService } from '../tmdb/tmdb-cache.service.js';

/** Scheduled background work. Every job can be disabled with JOBS_ENABLED=false. */
@Injectable()
export class MaintenanceJobs {
  private readonly logger = new Logger(MaintenanceJobs.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
    private readonly rateLimit: RateLimitService,
    private readonly otp: OtpProtectionService,
    private readonly tmdbCache: TmdbCacheService,
  ) {}

  @Cron('0 8 * * *', { name: 'release-reminders', timeZone: 'UTC' })
  async releaseRemindersJob(): Promise<void> {
    if (!this.config.jobsEnabled) return;
    await this.run('release reminders', () => this.sendReleaseReminders());
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup' })
  async cleanupJob(): Promise<void> {
    if (!this.config.jobsEnabled) return;
    await this.run('cleanup', async () => {
      const removed =
        (await this.rateLimit.purgeExpired()) +
        (await this.otp.purgeExpired()) +
        (await this.tmdbCache.purgeExpired());
      return removed;
    });
  }

  @Cron('30 3 * * *', { name: 'unconfirmed-accounts', timeZone: 'UTC' })
  async unconfirmedAccountsJob(): Promise<void> {
    if (!this.config.jobsEnabled) return;
    await this.run('unconfirmed accounts', () => this.removeUnconfirmedAccounts());
  }

  /**
   * Notifies users about watchlist movies released within the next 7 days. Each user is
   * reminded once per movie and release date (dedupe key), so the job can run repeatedly.
   */
  async sendReleaseReminders(now = new Date()): Promise<number> {
    const today = todayIsoDate(now);
    const inAWeek = todayIsoDate(addDays(now, 7));
    const rows = await this.db
      .select({
        userId: userMovies.userId,
        movieId: movies.id,
        tmdbId: movies.tmdbId,
        title: movies.title,
        releaseDate: movies.releaseDate,
      })
      .from(userMovies)
      .innerJoin(movies, eq(movies.id, userMovies.movieId))
      .where(
        and(eq(userMovies.status, 'want_to_watch'), between(movies.releaseDate, today, inAWeek)),
      );

    const byMovie = new Map<
      string,
      { tmdbId: number; title: string; releaseDate: string; userIds: string[] }
    >();
    for (const row of rows) {
      const entry = byMovie.get(row.movieId) ?? {
        tmdbId: row.tmdbId,
        title: row.title,
        releaseDate: row.releaseDate!,
        userIds: [],
      };
      entry.userIds.push(row.userId);
      byMovie.set(row.movieId, entry);
    }
    for (const [movieId, movie] of byMovie) {
      await this.notifications.notify({
        recipientIds: movie.userIds,
        type: 'watchlist_release_upcoming',
        title:
          movie.releaseDate === today
            ? `${movie.title} is out today`
            : `${movie.title} comes out on ${movie.releaseDate}`,
        body: 'It is on your watchlist.',
        data: { tmdbId: movie.tmdbId, releaseDate: movie.releaseDate },
        dedupeKey: `release:${movieId}:${movie.releaseDate}`,
      });
    }
    return rows.length;
  }

  /** Accounts created by requesting a code that was never confirmed within 7 days. */
  async removeUnconfirmedAccounts(): Promise<number> {
    const result = await this.db.execute(sql`
      delete from auth.users
      where email_confirmed_at is null and last_sign_in_at is null and created_at < now() - interval '7 days'
    `);
    return result.rowCount ?? 0;
  }

  private async run(name: string, job: () => Promise<number>): Promise<void> {
    try {
      const count = await job();
      if (count > 0) this.logger.log(`${name}: ${count} item(s) processed`);
    } catch (error) {
      this.logger.error(`${name} failed: ${(error as Error).message}`);
    }
  }
}
