import type { NestExpressApplication } from '@nestjs/platform-express';
import { buildOpenApiDocument } from '../src/swagger.js';
import { TestApp } from './utils/test-app.js';

// Developer endpoints are off in tests by default; this file turns them on.
process.env.DEV_TOOLS_ENABLED = 'true';

describe('Developer tools for testing through Swagger (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  afterAll(async () => {
    await t.close();
  });

  it('signs in without an email and the token works right away', async () => {
    const email = t.uniqueEmail('quick');
    const response = await t.http().post('/api/v1/dev/sign-in').send({ email }).expect(200);
    expect(response.body).toMatchObject({
      user: { email },
      needsOnboarding: true,
      tokenType: 'bearer',
    });

    await t
      .http()
      .get('/api/v1/me')
      .set({ Authorization: `Bearer ${response.body.accessToken}` })
      .expect(200);
    // No 60-second wait between quick sign-ins.
    await t.http().post('/api/v1/dev/sign-in').send({ email }).expect(200);
  });

  it('reads sign-in codes from the local mailbox', async () => {
    const email = t.uniqueEmail('mailbox');
    await t.http().post('/api/v1/auth/otp').send({ email }).expect(202);
    let code: string | null = null;
    for (let attempt = 0; attempt < 20 && !code; attempt += 1) {
      const mailbox = await t.http().get('/api/v1/dev/mailbox').query({ email }).expect(200);
      code = mailbox.body.messages[0]?.code ?? null;
      if (!code) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(code).toMatch(/^\d{6}$/);
    await t.http().post('/api/v1/auth/otp/verify').send({ email, code }).expect(200);
  });

  it('creates a demo family once and reuses it', async () => {
    const namespace = `e2e${Date.now().toString(36)}`;
    const first = await t.http().post('/api/v1/dev/demo').send({ namespace }).expect(200);
    for (const member of first.body.users) t.trackUser(member.userId);
    expect(first.body.users.map((u: { email: string }) => u.email)).toEqual([
      `anna.${namespace}@example.com`,
      `ben.${namespace}@example.com`,
      `chloe.${namespace}@example.com`,
    ]);

    const chloe = { Authorization: `Bearer ${first.body.users[2].accessToken}` };
    const night = await t
      .http()
      .get(`/api/v1/movie-nights/${first.body.movieNightId}`)
      .set(chloe)
      .expect(200);
    expect(night.body).toMatchObject({ status: 'voting', participantCount: 3, votesCast: 2 });
    expect(night.body.candidates.length).toBeGreaterThanOrEqual(2);
    await t
      .http()
      .put(`/api/v1/movie-nights/${first.body.movieNightId}/vote`)
      .set(chloe)
      .send({ tmdbId: night.body.candidates[0].movie.tmdbId })
      .expect(200);

    const catalog = await t
      .http()
      .get(`/api/v1/groups/${first.body.groupId}/movies`)
      .set(chloe)
      .expect(200);
    expect(catalog.body.total).toBe(8);
    await t.http().get(`/api/v1/collections/${first.body.collectionId}`).set(chloe).expect(200);

    const again = await t.http().post('/api/v1/dev/demo').send({ namespace }).expect(200);
    expect(again.body.groupId).toBe(first.body.groupId);
  });

  it('documents the developer endpoints in Swagger', () => {
    const document = buildOpenApiDocument(t.app as NestExpressApplication, t.config);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/api/v1/dev/sign-in', '/api/v1/dev/mailbox', '/api/v1/dev/demo']),
    );
    expect(document.info.description).toContain('POST /api/v1/dev/sign-in');
  });
});
