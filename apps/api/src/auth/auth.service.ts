import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { sha256, normalizeEmail } from '../common/utils/crypto.js';
import {
  AppException,
  badRequest,
  forbidden,
  notFound,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
} from '../common/errors.js';
import { AuditService } from '../audit/audit.service.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { auditEvents, profiles } from '../database/schema/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { AuthSessionsRepository } from './auth-sessions.repository.js';
import type { AuthUser, ClientContext } from './auth.types.js';
import type {
  ActiveSessionDto,
  AuthSessionDto,
  OtpRequestResponseDto,
  SignOutScope,
} from './dto/auth.dto.js';
import { OtpProtectionService } from './otp-protection.service.js';
import { describeUserAgent } from './user-agent.js';
import { isSharedDemoEmail } from './demo-accounts.js';

const OTP_LENGTH = 6;
const SIGN_IN_ACTIONS = ['auth.sign_up', 'auth.sign_in'];
const SIGN_IN_METHODS = {
  otp: 'an email code',
  magic_link: 'a magic link',
  dev: 'the developer quick sign-in',
  demo: 'the demo account sign-in',
} as const;
type SignInMethod = keyof typeof SIGN_IN_METHODS;

/**
 * Passwordless authentication on top of Supabase Auth. The API is the only client of Supabase
 * Auth, which lets it add its own protection (rate limits, attempt counting) and keep the
 * responses identical for registered and unregistered addresses.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly otp: OtpProtectionService,
    private readonly sessions: AuthSessionsRepository,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    @InjectDb() private readonly db: Database,
  ) {}

  async requestCode(rawEmail: string, client: ClientContext): Promise<OtpRequestResponseDto> {
    const email = normalizeEmail(rawEmail);
    const emailHash = sha256(email);
    await this.otp.assertCanSend(emailHash, client.ip);

    const { error } = await this.supabase
      .createAuthClient(client)
      .auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw this.mapSendError(error);

    await this.otp.recordSent(emailHash);
    return {
      email,
      codeLength: OTP_LENGTH,
      expiresInSeconds: this.config.auth.otpExpirySeconds,
      resendAvailableInSeconds: this.config.auth.otpResendIntervalSeconds,
    };
  }

  async verifyCode(rawEmail: string, code: string, client: ClientContext): Promise<AuthSessionDto> {
    const email = normalizeEmail(rawEmail);
    const emailHash = sha256(email);
    const state = await this.otp.assertCanVerify(emailHash, client.ip);

    const { data, error } = await this.supabase
      .createAuthClient(client)
      .auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !data.session || !data.user) {
      if (error && !this.isRejectedToken(error)) throw this.mapUnexpectedError(error);
      const failure = await this.otp.recordFailure(emailHash, state);
      if (failure.expired) {
        throw unauthorized('OTP_EXPIRED', 'This code has expired. Request a new one.');
      }
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'OTP_INVALID',
        failure.attemptsRemaining > 0
          ? 'That code is not correct. Check the latest email and try again.'
          : 'That code is not correct. Request a new code to continue.',
        { attemptsRemaining: failure.attemptsRemaining },
      );
    }

    await this.otp.recordSuccess(emailHash);
    return this.completeSignIn(data.session, data.user, client, 'otp');
  }

  /**
   * Re-verifies the signed-in user's email with a fresh code before a sensitive action
   * (account deletion). The temporary session created by the check is closed right away.
   */
  async confirmIdentity(user: AuthUser, code: string, client: ClientContext): Promise<void> {
    const email = normalizeEmail(user.email);
    const emailHash = sha256(email);
    const state = await this.otp.assertCanVerify(emailHash, client.ip);
    const { data, error } = await this.supabase
      .createAuthClient(client)
      .auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !data.session || data.user?.id !== user.id) {
      if (error && !this.isRejectedToken(error)) throw this.mapUnexpectedError(error);
      const failure = await this.otp.recordFailure(emailHash, state);
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        failure.expired ? 'OTP_EXPIRED' : 'OTP_INVALID',
        failure.expired ? 'This code has expired. Request a new one.' : 'That code is not correct.',
        { attemptsRemaining: failure.attemptsRemaining },
      );
    }
    await this.otp.recordSuccess(emailHash);
    await this.supabase.admin.auth.admin.signOut(data.session.access_token, 'local');
  }

  /**
   * Development only (DEV_TOOLS_ENABLED): signs in as any address without sending an email.
   * The account is created or confirmed with the Supabase admin API, then a one-time magic link
   * is generated and verified, so the session is a regular Supabase session.
   */
  devSignIn(rawEmail: string, client: ClientContext): Promise<AuthSessionDto> {
    return this.signInWithoutCode(rawEmail, client, 'dev');
  }

  /**
   * Signs in without an email code: any address with developer tools (`'dev'`), or only the
   * shared demo accounts when `DEMO_ACCOUNTS_ENABLED` (`'demo'`). Creates the account if needed.
   */
  async signInWithoutCode(
    rawEmail: string,
    client: ClientContext,
    method: 'dev' | 'demo',
  ): Promise<AuthSessionDto> {
    const email = normalizeEmail(rawEmail);
    const allowed =
      method === 'dev'
        ? this.config.devTools.enabled
        : this.config.demoAccounts.enabled && isSharedDemoEmail(email);
    if (!allowed) throw notFound('NOT_FOUND', 'Not found.');
    const admin = this.supabase.admin.auth.admin;

    const existing = await this.db.execute<{ id: string; email_confirmed_at: string | null }>(
      sql`select id, email_confirmed_at from auth.users where email = ${email} limit 1`,
    );
    const account = existing.rows[0];
    if (!account) {
      const { error } = await admin.createUser({ email, email_confirm: true });
      if (error) throw this.mapUnexpectedError(error);
    } else if (!account.email_confirmed_at) {
      const { error } = await admin.updateUserById(account.id, { email_confirm: true });
      if (error) throw this.mapUnexpectedError(error);
    }

    const link = await admin.generateLink({ type: 'magiclink', email });
    if (link.error) throw this.mapUnexpectedError(link.error);
    const tokenHash = link.data.properties?.hashed_token;
    if (!tokenHash)
      throw serviceUnavailable('AUTH_UNAVAILABLE', 'Could not create a sign-in link.');

    const { data, error } = await this.supabase
      .createAuthClient(client)
      .auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    if (error) throw this.mapUnexpectedError(error);
    if (!data.session || !data.user) {
      throw serviceUnavailable('AUTH_UNAVAILABLE', 'Supabase Auth returned no session.');
    }
    return this.completeSignIn(data.session, data.user, client, method);
  }

  async verifyMagicLink(tokenHash: string, client: ClientContext): Promise<AuthSessionDto> {
    await this.otp.assertCanVerify(null, client.ip);
    const { data, error } = await this.supabase
      .createAuthClient(client)
      .auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error || !data.session || !data.user) {
      if (error && !this.isRejectedToken(error)) throw this.mapUnexpectedError(error);
      throw unauthorized(
        'MAGIC_LINK_INVALID',
        'This sign-in link is invalid, has expired or was already used. Request a new one.',
      );
    }
    if (data.user.email) await this.otp.recordSuccess(sha256(normalizeEmail(data.user.email)));
    return this.completeSignIn(data.session, data.user, client, 'magic_link');
  }

  async refresh(refreshToken: string, client: ClientContext): Promise<AuthSessionDto> {
    const { data, error } = await this.supabase
      .createAuthClient(client)
      .auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      if (error && (error.status ?? 0) >= 500) throw this.mapUnexpectedError(error);
      throw unauthorized('REFRESH_TOKEN_INVALID', 'Your session has ended. Sign in again.');
    }
    return this.toSessionDto(data.session, data.user, await this.needsOnboarding(data.user.id));
  }

  async signOut(user: AuthUser, scope: SignOutScope, client: ClientContext): Promise<void> {
    const { error } = await this.supabase.admin.auth.admin.signOut(user.accessToken, scope);
    if (error && ![401, 403, 404].includes(error.status ?? 0)) throw this.mapUnexpectedError(error);
    await this.audit.record({
      actorId: user.id,
      action: `auth.sign_out.${scope}`,
      entityType: 'user',
      entityId: user.id,
      ipAddress: client.ip,
    });
  }

  async listSessions(user: AuthUser): Promise<ActiveSessionDto[]> {
    const sessions = await this.sessions.list(user.id);
    // Visitors share the demo accounts, so they must not see each other's IP addresses.
    const hideIp = isSharedDemoEmail(user.email);
    return sessions.map((session) => ({
      ...session,
      ...(hideIp ? { ipAddress: null } : {}),
      current: session.id === user.sessionId,
      device: describeUserAgent(session.userAgent),
    }));
  }

  async revokeSession(user: AuthUser, sessionId: string, client: ClientContext): Promise<void> {
    if (!(await this.sessions.revoke(user.id, sessionId))) {
      throw notFound('SESSION_NOT_FOUND', 'Session not found.');
    }
    await this.audit.record({
      actorId: user.id,
      action: 'auth.session_revoked',
      entityType: 'session',
      entityId: sessionId,
      ipAddress: client.ip,
    });
  }

  private async completeSignIn(
    session: Session,
    user: User,
    client: ClientContext,
    method: SignInMethod,
  ): Promise<AuthSessionDto> {
    const email = normalizeEmail(user.email ?? '');
    // Normally created by the auth.users trigger; this keeps sign-in working if it was not.
    await this.db.insert(profiles).values({ id: user.id, email }).onConflictDoNothing();
    const needsOnboarding = await this.needsOnboarding(user.id);
    const isNewAccount = !(await this.hasSignedInBefore(user.id));

    await this.audit.record({
      actorId: user.id,
      action: isNewAccount ? 'auth.sign_up' : 'auth.sign_in',
      entityType: 'user',
      entityId: user.id,
      metadata: { method, userAgent: client.userAgent },
      ipAddress: client.ip,
    });
    // Shared demo accounts skip it: it would show one visitor's IP and device to the others.
    if (!isNewAccount && method !== 'demo') {
      await this.notifications.notify({
        recipientIds: [user.id],
        type: 'security_new_sign_in',
        title: 'New sign-in to your account',
        body: `Signed in with ${SIGN_IN_METHODS[method]} from ${describeUserAgent(client.userAgent)}${client.ip ? ` (${client.ip})` : ''}. If this was not you, sign out of all devices.`,
        data: { method },
      });
    }
    return this.toSessionDto(session, user, needsOnboarding);
  }

  private async hasSignedInBefore(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, userId), inArray(auditEvents.action, SIGN_IN_ACTIONS)))
      .limit(1);
    return rows.length > 0;
  }

  private async needsOnboarding(userId: string): Promise<boolean> {
    const [profile] = await this.db
      .select({ onboardingCompletedAt: profiles.onboardingCompletedAt })
      .from(profiles)
      .where(eq(profiles.id, userId));
    return !profile?.onboardingCompletedAt;
  }

  private toSessionDto(session: Session, user: User, needsOnboarding: boolean): AuthSessionDto {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      tokenType: session.token_type,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
      user: { id: user.id, email: normalizeEmail(user.email ?? '') },
      needsOnboarding,
    };
  }

  /** Wrong, expired or already used codes/links (as opposed to outages). */
  private isRejectedToken(error: AuthError): boolean {
    const status = error.status ?? 0;
    return status >= 400 && status < 500 && status !== 429;
  }

  private mapSendError(error: AuthError): AppException {
    const status = error.status ?? 0;
    const code = error.code ?? '';
    if (status === 429 || code.startsWith('over_')) {
      const seconds = Number(/(\d+)\s*seconds?/.exec(error.message)?.[1] ?? 60);
      return tooManyRequests(
        'OTP_RATE_LIMITED',
        'Please wait a moment before requesting another code.',
        seconds,
      );
    }
    if (['signup_disabled', 'otp_disabled', 'email_provider_disabled'].includes(code)) {
      return forbidden('SIGN_IN_DISABLED', 'Email sign-in is currently disabled.');
    }
    if (status === 400 || status === 422) {
      return badRequest('EMAIL_INVALID', 'Enter a valid email address.');
    }
    return this.mapUnexpectedError(error);
  }

  private mapUnexpectedError(error: AuthError): AppException {
    if (error.status === 429) {
      return tooManyRequests('AUTH_RATE_LIMITED', 'Too many attempts. Try again in a minute.', 60);
    }
    this.logger.error(
      `Supabase Auth error (${error.status ?? 'network'} ${error.code ?? ''}): ${error.message}`,
    );
    return serviceUnavailable(
      'AUTH_UNAVAILABLE',
      'Sign-in is temporarily unavailable. Please try again.',
    );
  }
}
