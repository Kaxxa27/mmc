import { createHash } from 'node:crypto';
import { extractCode, extractTokenHash, waitForEmail } from './utils/mailpit.js';
import { TestApp } from './utils/test-app.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('Passwordless authentication (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  afterAll(async () => {
    await t.close();
  });

  /** Moves the "code sent" timestamps back so a new code can be requested right away. */
  async function backdateCode(email: string, interval: string): Promise<void> {
    await t.db.query(
      `update auth_otp_state set last_sent_at = now() - $2::interval where email_hash = $1`,
      [sha256(email), interval],
    );
    await t.db.query(
      `update auth.users
         set confirmation_sent_at = now() - $2::interval, recovery_sent_at = now() - $2::interval
       where email = $1`,
      [email, interval],
    );
    await t.db.query(
      `update auth.one_time_tokens set created_at = now() - $2::interval
       where relates_to = $1`,
      [email, interval],
    );
  }

  async function requestCode(email: string): Promise<string> {
    const since = new Date();
    await t.http().post('/api/v1/auth/otp').send({ email }).expect(202);
    return extractCode(await waitForEmail(email, { since }));
  }

  it('creates an account for a new address and signs the user in', async () => {
    const email = t.uniqueEmail('new');
    const since = new Date();
    const response = await t.http().post('/api/v1/auth/otp').send({ email: email.toUpperCase() });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      email,
      codeLength: 6,
      expiresInSeconds: 600,
      resendAvailableInSeconds: 60,
    });

    const message = await waitForEmail(email, { since });
    expect(message.Subject).toContain('Welcome');
    const code = extractCode(message);

    const verified = await t
      .http()
      .post('/api/v1/auth/otp/verify')
      .send({ email, code })
      .expect(200);
    t.trackUser(verified.body.user.id);
    expect(verified.body).toMatchObject({
      tokenType: 'bearer',
      user: { email },
      needsOnboarding: true,
    });
    expect(verified.body.accessToken).toEqual(expect.any(String));

    const profile = await t.db.query('select email from profiles where id = $1', [
      verified.body.user.id,
    ]);
    expect(profile.rows).toEqual([{ email }]);

    const sessions = await t
      .http()
      .get('/api/v1/auth/sessions')
      .set({ Authorization: `Bearer ${verified.body.accessToken}` })
      .expect(200);
    expect(sessions.body).toHaveLength(1);
    expect(sessions.body[0].current).toBe(true);
  });

  it('signs an existing user in with a new code and records the sign-in', async () => {
    const user = await t.signIn();
    await backdateCode(user.email, '2 minutes');
    const code = await requestCode(user.email);

    const response = await t
      .http()
      .post('/api/v1/auth/otp/verify')
      .send({ email: user.email, code });
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(user.id);

    const notifications = await t
      .http()
      .get('/api/v1/me/notifications')
      .set({ Authorization: `Bearer ${response.body.accessToken}` })
      .expect(200);
    expect(notifications.body.items.map((n: { type: string }) => n.type)).toContain(
      'security_new_sign_in',
    );
  });

  it('answers the same way for registered and unregistered addresses', async () => {
    const existing = await t.signIn();
    await backdateCode(existing.email, '2 minutes');
    const forExisting = await t.http().post('/api/v1/auth/otp').send({ email: existing.email });
    const unknownEmail = t.uniqueEmail('unknown');
    const forUnknown = await t.http().post('/api/v1/auth/otp').send({ email: unknownEmail });

    expect(forExisting.status).toBe(forUnknown.status);
    const { email: _a, ...existingBody } = forExisting.body;
    const { email: _b, ...unknownBody } = forUnknown.body;
    expect(existingBody).toEqual(unknownBody);
  });

  it('rejects invalid codes and counts the attempts', async () => {
    const email = t.uniqueEmail('invalid');
    await requestCode(email);
    const response = await t
      .http()
      .post('/api/v1/auth/otp/verify')
      .send({ email, code: '000000' })
      .expect(401);
    expect(response.body).toMatchObject({ code: 'OTP_INVALID', details: { attemptsRemaining: 4 } });
  });

  it('rejects malformed input', async () => {
    const response = await t
      .http()
      .post('/api/v1/auth/otp/verify')
      .send({ email: 'someone@example.com', code: '12ab', extra: true })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('rejects expired codes', async () => {
    const email = t.uniqueEmail('expired');
    const code = await requestCode(email);
    await backdateCode(email, '1 hour');

    const response = await t
      .http()
      .post('/api/v1/auth/otp/verify')
      .send({ email, code })
      .expect(401);
    expect(response.body.code).toBe('OTP_EXPIRED');
  });

  it('does not accept a code twice', async () => {
    const email = t.uniqueEmail('reuse');
    const code = await requestCode(email);
    const first = await t.http().post('/api/v1/auth/otp/verify').send({ email, code }).expect(200);
    t.trackUser(first.body.user.id);

    const second = await t.http().post('/api/v1/auth/otp/verify').send({ email, code }).expect(401);
    expect(second.body.code).toBe('OTP_INVALID');
  });

  it('restricts repeated code requests and too many wrong codes', async () => {
    const email = t.uniqueEmail('limits');
    const code = await requestCode(email);

    const resend = await t.http().post('/api/v1/auth/otp').send({ email }).expect(429);
    expect(resend.body.code).toBe('OTP_RESEND_TOO_SOON');
    expect(Number(resend.headers['retry-after'])).toBeGreaterThan(0);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await t.http().post('/api/v1/auth/otp/verify').send({ email, code: '111111' }).expect(401);
    }
    // Even the right code is refused now; a new code must be requested.
    const locked = await t.http().post('/api/v1/auth/otp/verify').send({ email, code }).expect(429);
    expect(locked.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('signs in with a magic link exactly once', async () => {
    const email = t.uniqueEmail('magic');
    const since = new Date();
    await t.http().post('/api/v1/auth/otp').send({ email }).expect(202);
    const tokenHash = extractTokenHash(await waitForEmail(email, { since }));

    const first = await t
      .http()
      .post('/api/v1/auth/magic-link/verify')
      .send({ tokenHash })
      .expect(200);
    t.trackUser(first.body.user.id);
    expect(first.body.user.email).toBe(email);

    const second = await t
      .http()
      .post('/api/v1/auth/magic-link/verify')
      .send({ tokenHash })
      .expect(401);
    expect(second.body.code).toBe('MAGIC_LINK_INVALID');
  });

  it('keeps the session alive with rotating refresh tokens', async () => {
    const user = await t.signIn();
    const refreshed = await t
      .http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(user.refreshToken);

    await t
      .http()
      .get('/api/v1/me/notifications')
      .set({ Authorization: `Bearer ${refreshed.body.accessToken}` })
      .expect(200);

    const bogus = await t
      .http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' });
    expect(bogus.status).toBe(401);
    expect(bogus.body.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('signs out the current device and rejects its token immediately', async () => {
    const user = await t.signIn();
    await t.http().post('/api/v1/auth/sign-out').set(user.auth).send({}).expect(204);

    const response = await t.http().get('/api/v1/me/notifications').set(user.auth).expect(401);
    expect(response.body.code).toBe('SESSION_REVOKED');
  });

  it('signs out of every device at once', async () => {
    const laptop = await t.signIn();
    await backdateCode(laptop.email, '2 minutes');
    const code = await requestCode(laptop.email);
    const phone = await t
      .http()
      .post('/api/v1/auth/otp/verify')
      .send({ email: laptop.email, code })
      .expect(200);
    const phoneAuth = { Authorization: `Bearer ${phone.body.accessToken}` };

    const sessions = await t.http().get('/api/v1/auth/sessions').set(phoneAuth).expect(200);
    expect(sessions.body).toHaveLength(2);

    await t
      .http()
      .post('/api/v1/auth/sign-out')
      .set(phoneAuth)
      .send({ scope: 'global' })
      .expect(204);
    await t.http().get('/api/v1/me/notifications').set(laptop.auth).expect(401);
    await t.http().get('/api/v1/me/notifications').set(phoneAuth).expect(401);
  });

  it('rejects missing and forged tokens', async () => {
    const missing = await t.http().get('/api/v1/me/notifications').expect(401);
    expect(missing.body.code).toBe('AUTH_REQUIRED');

    const forged = await t
      .http()
      .get('/api/v1/me/notifications')
      .set({ Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl' })
      .expect(401);
    expect(forged.body.code).toBe('TOKEN_INVALID');
  });

  it('keeps application tables out of reach of the public Supabase API keys', async () => {
    const response = await fetch(`${t.config.supabase.url}/rest/v1/profiles?select=email`, {
      headers: { apikey: t.config.supabase.anonKey },
    });
    expect(response.status).toBe(401);
  });
});
