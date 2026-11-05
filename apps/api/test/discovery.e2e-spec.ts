import type { NestExpressApplication } from '@nestjs/platform-express';
import { MaintenanceJobs } from '../src/jobs/maintenance.jobs.js';
import { buildOpenApiDocument } from '../src/swagger.js';
import { TestApp, type TestUser } from './utils/test-app.js';

const TOY_STORY = 862;
const UP = 14160;
const SHAWSHANK = 278;

describe('Home, recommendations, calendar and reminders (e2e)', () => {
  let t: TestApp;
  let user: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
    user = await t.signInWithProfile('Rita'); // favorite genres: comedy, animation
  });

  afterAll(async () => {
    await t.close();
  });

  it('serves a home page for guests', async () => {
    const response = await t.http().get('/api/v1/home').expect(200);
    expect(response.body.welcome).toBeNull();
    expect(response.body.sections.map((s: { key: string }) => s.key)).toEqual(
      expect.arrayContaining(['trending', 'popular', 'top-rated']),
    );
    expect(response.body.watchlist).toBeNull();
  });

  it('personalises the home page and recommendations', async () => {
    await t
      .http()
      .put(`/api/v1/me/movies/${TOY_STORY}`)
      .set(user.auth)
      .send({ status: 'watched', rating: 9, isFavorite: true })
      .expect(201);
    await t.http().put(`/api/v1/me/movies/${SHAWSHANK}`).set(user.auth).send({}).expect(201);
    await t.http().get(`/api/v1/movies/${UP}`).set(user.auth).expect(200); // explored, not saved

    const home = await t.http().get('/api/v1/home').set(user.auth).expect(200);
    expect(home.body.welcome).toEqual({ displayName: 'Rita' });
    expect(home.body.watchlist.map((e: { movie: { tmdbId: number } }) => e.movie.tmdbId)).toEqual([
      SHAWSHANK,
    ]);
    const keys = home.body.sections.map((s: { key: string }) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining(['because_you_liked', 'favorite_genres', 'continue_exploring']),
    );

    const recommendations = await t
      .http()
      .get('/api/v1/me/recommendations')
      .set(user.auth)
      .expect(200);
    const all = recommendations.body.sections.flatMap((s: { movies: { tmdbId: number }[] }) =>
      s.movies.map((m) => m.tmdbId),
    );
    expect(all).not.toContain(TOY_STORY); // already in the catalog
    expect(all).not.toContain(SHAWSHANK);

    const because = recommendations.body.sections.find(
      (s: { key: string }) => s.key === 'because_you_liked',
    );
    expect(because.title).toBe('Because you liked Toy Story');
    const dismissed = because.movies[0].tmdbId as number;
    await t
      .http()
      .put(`/api/v1/me/movies/${dismissed}`)
      .set(user.auth)
      .send({ status: 'not_interested' })
      .expect(201);
    const again = await t.http().get('/api/v1/me/recommendations').set(user.auth).expect(200);
    const remaining = again.body.sections.flatMap((s: { movies: { tmdbId: number }[] }) =>
      s.movies.map((m) => m.tmdbId),
    );
    expect(remaining).not.toContain(dismissed);
  });

  it('shows viewings and movie nights in the calendar', async () => {
    await t
      .http()
      .post('/api/v1/me/history')
      .set(user.auth)
      .send({ tmdbId: UP, watchedOn: '2026-10-15' })
      .expect(201);
    const group = await t
      .http()
      .post('/api/v1/groups')
      .set(user.auth)
      .send({ name: 'Calendar crew' })
      .expect(201);
    await t
      .http()
      .post(`/api/v1/groups/${group.body.id}/movie-nights`)
      .set(user.auth)
      .send({ title: 'Halloween', scheduledAt: '2026-10-31T19:00:00Z' })
      .expect(201);

    const october = await t
      .http()
      .get('/api/v1/me/calendar?from=2026-10-01&to=2026-10-31')
      .set(user.auth)
      .expect(200);
    expect(october.body.events).toEqual([
      expect.objectContaining({
        type: 'viewing',
        date: '2026-10-15',
        movie: expect.objectContaining({ tmdbId: UP }),
      }),
      expect.objectContaining({
        type: 'movie_night',
        date: '2026-10-31',
        title: 'Halloween',
        isParticipant: true,
      }),
    ]);

    const groupCalendar = await t
      .http()
      .get(`/api/v1/groups/${group.body.id}/calendar?from=2026-10-01&to=2026-10-31`)
      .set(user.auth)
      .expect(200);
    expect(groupCalendar.body.events).toHaveLength(1);

    await t
      .http()
      .get('/api/v1/me/calendar?from=2026-10-31&to=2026-10-01')
      .set(user.auth)
      .expect(400);
  });

  it('reminds users once about upcoming releases on their watchlist', async () => {
    const tmdbId = 900_000_000 + Math.floor(Math.random() * 1_000_000);
    const releaseDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await t.db.query(
      `insert into movies (tmdb_id, title, release_date, genre_ids) values ($1, 'Future Test Movie', $2, '{35}')`,
      [tmdbId, releaseDate],
    );
    await t.http().put(`/api/v1/me/movies/${tmdbId}`).set(user.auth).send({}).expect(201);

    const jobs = t.app.get(MaintenanceJobs);
    await jobs.sendReleaseReminders();
    await jobs.sendReleaseReminders();

    const inbox = await t.http().get('/api/v1/me/notifications').set(user.auth).expect(200);
    const reminders = inbox.body.items.filter(
      (n: { type: string }) => n.type === 'watchlist_release_upcoming',
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toContain('Future Test Movie');
    await t.db.query('delete from movies where tmdb_id = $1', [tmdbId]);
  });

  it('hides the developer tools unless they are enabled', async () => {
    await t.http().post('/api/v1/dev/sign-in').send({ email: 'x@example.com' }).expect(404);
    await t.http().post('/api/v1/dev/demo').send({}).expect(404);
    const document = buildOpenApiDocument(t.app as NestExpressApplication, t.config);
    expect(Object.keys(document.paths).some((path) => path.includes('/dev/'))).toBe(false);
    expect(document.tags?.map((tag) => tag.name)).not.toContain('Dev tools');
  });

  it('exposes catalog metadata and health', async () => {
    const config = await t.http().get('/api/v1/config').expect(200);
    expect(config.body.movieData.attribution).toContain('TMDB');
    expect(config.body.enums.movieStatuses).toContain('want_to_watch');

    const health = await t.http().get('/api/v1/health').expect(200);
    expect(health.body.checks).toMatchObject({ database: 'up', auth: 'up', tmdb: 'disabled' });
  });
});
