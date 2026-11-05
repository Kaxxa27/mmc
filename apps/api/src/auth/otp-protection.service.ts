import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { tooManyRequests } from '../common/errors.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { authOtpState } from '../database/schema/index.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';

export interface OtpState {
  lastSentAt: Date;
  failedAttempts: number;
}

/**
 * Protects passwordless sign-in against abuse:
 * - per-IP and per-email hourly limits for sending codes,
 * - a minimum interval between two codes for the same email (the "resend" countdown),
 * - a cap on wrong codes per issued code (after that a new code is required),
 * - a per-IP limit on verification attempts.
 */
@Injectable()
export class OtpProtectionService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly rateLimit: RateLimitService,
    private readonly config: AppConfig,
  ) {}

  async assertCanSend(emailHash: string, ip: string | null): Promise<void> {
    const state = await this.getState(emailHash);
    if (state) {
      const waitSeconds = this.secondsUntilResend(state);
      if (waitSeconds > 0) {
        throw tooManyRequests(
          'OTP_RESEND_TOO_SOON',
          `Please wait ${waitSeconds} seconds before requesting a new code.`,
          waitSeconds,
        );
      }
    }
    const { otpRequestsPerHourPerIp, otpRequestsPerHourPerEmail } = this.config.auth;
    if (ip) {
      const byIp = await this.rateLimit.consume(`otp:send:ip:${ip}`, otpRequestsPerHourPerIp, 3600);
      if (!byIp.allowed) {
        throw tooManyRequests(
          'OTP_RATE_LIMITED',
          'Too many sign-in attempts. Try again later.',
          byIp.retryAfterSeconds,
        );
      }
    }
    const byEmail = await this.rateLimit.consume(
      `otp:send:email:${emailHash}`,
      otpRequestsPerHourPerEmail,
      3600,
    );
    if (!byEmail.allowed) {
      throw tooManyRequests(
        'OTP_RATE_LIMITED',
        'Too many codes were requested for this address. Try again later.',
        byEmail.retryAfterSeconds,
      );
    }
  }

  async recordSent(emailHash: string): Promise<void> {
    await this.db
      .insert(authOtpState)
      .values({ emailHash, lastSentAt: new Date(), failedAttempts: 0 })
      .onConflictDoUpdate({
        target: authOtpState.emailHash,
        set: { lastSentAt: new Date(), failedAttempts: 0 },
      });
  }

  /** Applies the verification limits and returns the current code state, if any. */
  async assertCanVerify(
    emailHash: string | null,
    ip: string | null,
  ): Promise<OtpState | undefined> {
    if (ip) {
      const byIp = await this.rateLimit.consume(
        `otp:verify:ip:${ip}`,
        this.config.auth.otpVerificationsPer15MinPerIp,
        900,
      );
      if (!byIp.allowed) {
        throw tooManyRequests(
          'OTP_VERIFY_RATE_LIMITED',
          'Too many attempts. Try again later.',
          byIp.retryAfterSeconds,
        );
      }
    }
    if (!emailHash) return undefined;
    const state = await this.getState(emailHash);
    if (state && state.failedAttempts >= this.config.auth.otpMaxFailedAttempts) {
      throw tooManyRequests(
        'OTP_ATTEMPTS_EXCEEDED',
        'Too many incorrect codes. Request a new code to continue.',
        this.secondsUntilResend(state),
      );
    }
    return state;
  }

  /** Counts a wrong code. `expired` tells the user whether to fix a typo or request a new code. */
  async recordFailure(
    emailHash: string,
    previous: OtpState | undefined,
  ): Promise<{ expired: boolean; attemptsRemaining: number }> {
    const [row] = await this.db
      .insert(authOtpState)
      .values({ emailHash, lastSentAt: new Date(0), failedAttempts: 1 })
      .onConflictDoUpdate({
        target: authOtpState.emailHash,
        set: { failedAttempts: sql`${authOtpState.failedAttempts} + 1` },
      })
      .returning({ failedAttempts: authOtpState.failedAttempts });
    const failedAttempts = row?.failedAttempts ?? 1;
    const expired =
      previous !== undefined &&
      previous.lastSentAt.getTime() + this.config.auth.otpExpirySeconds * 1000 < Date.now();
    return {
      expired,
      attemptsRemaining: Math.max(0, this.config.auth.otpMaxFailedAttempts - failedAttempts),
    };
  }

  async recordSuccess(emailHash: string): Promise<void> {
    await this.db.delete(authOtpState).where(eq(authOtpState.emailHash, emailHash));
  }

  /** Removes state for codes that expired long ago. */
  async purgeExpired(): Promise<number> {
    const result = await this.db.execute(
      sql`delete from auth_otp_state where last_sent_at < now() - interval '1 day'`,
    );
    return result.rowCount ?? 0;
  }

  private async getState(emailHash: string): Promise<OtpState | undefined> {
    const [state] = await this.db
      .select({ lastSentAt: authOtpState.lastSentAt, failedAttempts: authOtpState.failedAttempts })
      .from(authOtpState)
      .where(eq(authOtpState.emailHash, emailHash));
    return state;
  }

  private secondsUntilResend(state: OtpState): number {
    const readyAt = state.lastSentAt.getTime() + this.config.auth.otpResendIntervalSeconds * 1000;
    return Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
  }
}
