import { extractCode, waitForEmail } from './utils/mailpit.js';
import { TestApp, type TestUser } from './utils/test-app.js';

// Movies from the bundled offline sample (supabase/seed.sql).
const TOY_STORY = 862;
const FINDING_NEMO = 12;
const INCEPTION = 27205;
const SPIRITED_AWAY = 129;

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('Profile and personal catalog (e2e)', () => {
  let t: TestApp;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
    alice = await t.signIn(t.uniqueEmail('alice'));
    bob = await t.signInWithProfile('Bob');
  });

  afterAll(async () => {
    await t.close();
  });

  describe('profile', () => {
    it('completes onboarding with name, genres and preferences', async () => {
      const before = await t.http().get('/api/v1/me').set(alice.auth).expect(200);
      expect(before.body.onboardingCompleted).toBe(false);

      const response = await t
        .http()
        .post('/api/v1/me/onboarding')
        .set(alice.auth)
        .send({
          firstName: 'Alice',
          lastName: 'Smith',
          favoriteGenreIds: [16, 35],
          language: 'en-GB',
          region: 'gb',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        displayName: 'Alice Smith',
        onboardingCompleted: true,
        language: 'en-GB',
        region: 'GB',
        favoriteGenres: [
          { id: 16, name: 'Animation' },
          { id: 35, name: 'Comedy' },
        ],
      });

      const refreshed = await t
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: alice.refreshToken })
        .expect(200);
      expect(refreshed.body.needsOnboarding).toBe(false);
      alice.refreshToken = refreshed.body.refreshToken;
    });

    it('keeps usernames unique', async () => {
      const username = `alice_${Date.now().toString(36)}`;
      await t.http().patch('/api/v1/me').set(alice.auth).send({ username }).expect(200);

      const availability = await t
        .http()
        .get('/api/v1/me/username-availability')
        .query({ username })
        .set(bob.auth)
        .expect(200);
      expect(availability.body.available).toBe(false);

      const taken = await t.http().patch('/api/v1/me').set(bob.auth).send({ username }).expect(409);
      expect(taken.body.code).toBe('USERNAME_TAKEN');

      await t.http().patch('/api/v1/me').set(bob.auth).send({ username: 'No Spaces!' }).expect(400);
    });

    it('rejects unknown genres', async () => {
      const response = await t
        .http()
        .patch('/api/v1/me')
        .set(alice.auth)
        .send({ favoriteGenreIds: [999999] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('UNKNOWN_GENRE');
    });

    it('uploads an avatar and refuses non-images', async () => {
      const uploaded = await t
        .http()
        .put('/api/v1/me/avatar')
        .set(alice.auth)
        .attach('file', PNG_1x1, { filename: 'me.png', contentType: 'image/png' })
        .expect(200);
      expect(uploaded.body.avatarUrl).toMatch(/\/storage\/v1\/object\/public\/media\/users\//);
      const image = await fetch(uploaded.body.avatarUrl as string);
      expect(image.status).toBe(200);

      const svg = await t
        .http()
        .put('/api/v1/me/avatar')
        .set(alice.auth)
        .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(svg.body.code).toBe('UNSUPPORTED_IMAGE');

      const removed = await t.http().delete('/api/v1/me/avatar').set(alice.auth).expect(200);
      expect(removed.body.avatarUrl).toBeNull();
    });
  });

  describe('catalog', () => {
    it('adds a movie, changes its status and keeps the entry after updates', async () => {
      const added = await t
        .http()
        .put(`/api/v1/me/movies/${TOY_STORY}`)
        .set(alice.auth)
        .send({})
        .expect(201);
      expect(added.body).toMatchObject({
        status: 'want_to_watch',
        isFavorite: false,
        movie: { tmdbId: TOY_STORY, title: 'Toy Story', runtime: 81 },
      });

      const watching = await t
        .http()
        .put(`/api/v1/me/movies/${TOY_STORY}`)
        .set(alice.auth)
        .send({ status: 'watching' })
        .expect(200);
      expect(watching.body.status).toBe('watching');

      const watched = await t
        .http()
        .put(`/api/v1/me/movies/${TOY_STORY}`)
        .set(alice.auth)
        .send({ status: 'watched', rating: 9, isFavorite: true, notes: 'Watch with family' })
        .expect(200);
      expect(watched.body).toMatchObject({
        status: 'watched',
        rating: 9,
        isFavorite: true,
        notes: 'Watch with family',
        watchCount: 1,
      });
      expect(watched.body.lastWatchedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('annotates movie lists with the user status', async () => {
      const response = await t
        .http()
        .get(`/api/v1/movies/${TOY_STORY}`)
        .set(alice.auth)
        .expect(200);
      expect(response.body.userState).toMatchObject({
        status: 'watched',
        isFavorite: true,
        rating: 9,
      });

      const guest = await t.http().get(`/api/v1/movies/${TOY_STORY}`).expect(200);
      expect(guest.body.userState).toBeUndefined();
    });

    it('never exposes private notes or entries to other users', async () => {
      await t.http().get(`/api/v1/me/movies/${TOY_STORY}`).set(bob.auth).expect(404);
      const bobsView = await t.http().get(`/api/v1/movies/${TOY_STORY}`).set(bob.auth).expect(200);
      expect(bobsView.body.userState).toBeNull();
      const bobsCatalog = await t.http().get('/api/v1/me/movies').set(bob.auth).expect(200);
      expect(bobsCatalog.body.total).toBe(0);
    });

    it('filters, searches and sorts the catalog', async () => {
      await t
        .http()
        .put(`/api/v1/me/movies/${FINDING_NEMO}`)
        .set(alice.auth)
        .send({ rating: 7 })
        .expect(201);
      await t.http().put(`/api/v1/me/movies/${INCEPTION}`).set(alice.auth).send({}).expect(201);
      await t
        .http()
        .put(`/api/v1/me/movies/${SPIRITED_AWAY}`)
        .set(alice.auth)
        .send({ status: 'not_interested' })
        .expect(201);

      const all = await t.http().get('/api/v1/me/movies').set(alice.auth).expect(200);
      expect(all.body.total).toBe(3); // not_interested is hidden by default

      const animated = await t
        .http()
        .get('/api/v1/me/movies?genreIds=16&sort=rating_desc')
        .set(alice.auth)
        .expect(200);
      expect(animated.body.items.map((e: { movie: { tmdbId: number } }) => e.movie.tmdbId)).toEqual(
        [TOY_STORY, FINDING_NEMO],
      );

      const watchlist = await t
        .http()
        .get('/api/v1/me/movies?status=want_to_watch')
        .set(alice.auth)
        .expect(200);
      expect(watchlist.body.items.map((e: { movie: { title: string } }) => e.movie.title)).toEqual([
        'Inception',
      ]);

      const favorites = await t
        .http()
        .get('/api/v1/me/movies?favorite=true')
        .set(alice.auth)
        .expect(200);
      expect(favorites.body.total).toBe(1);

      const search = await t.http().get('/api/v1/me/movies?query=nemo').set(alice.auth).expect(200);
      expect(search.body.items[0].movie.title).toBe('Finding Nemo');

      const hidden = await t
        .http()
        .get('/api/v1/me/movies?status=not_interested')
        .set(alice.auth)
        .expect(200);
      expect(hidden.body.total).toBe(1);

      const random = await t.http().get('/api/v1/me/movies/random').set(alice.auth).expect(200);
      expect(random.body.movie.title).toBe('Inception');

      const lists = await t.http().get('/api/v1/me/lists').set(alice.auth).expect(200);
      const counts = Object.fromEntries(
        lists.body.lists.map((l: { key: string; count: number }) => [l.key, l.count]),
      );
      expect(counts).toMatchObject({ watchlist: 1, watched: 2, favorites: 1, highest_rated: 1 });
    });

    it('records viewing history including rewatches', async () => {
      const rewatch = await t
        .http()
        .post('/api/v1/me/history')
        .set(alice.auth)
        .send({
          tmdbId: TOY_STORY,
          watchedOn: '2025-12-24',
          rating: 10,
          notes: 'Christmas rewatch',
        })
        .expect(201);
      expect(rewatch.body).toMatchObject({ isRewatch: true, watchedOn: '2025-12-24', rating: 10 });

      await t
        .http()
        .post('/api/v1/me/history')
        .set(alice.auth)
        .send({ tmdbId: TOY_STORY, watchedOn: '2999-01-01' })
        .expect(400);

      // Marking Toy Story as watched logged one viewing; a rating alone (Finding Nemo) does not.
      const history = await t.http().get('/api/v1/me/history').set(alice.auth).expect(200);
      expect(history.body.total).toBe(2);
      const toyStory = await t
        .http()
        .get(`/api/v1/me/movies/${TOY_STORY}`)
        .set(alice.auth)
        .expect(200);
      expect(toyStory.body).toMatchObject({
        watchCount: 2,
        lastWatchedOn: expect.any(String),
        rating: 10,
      });

      const moved = await t
        .http()
        .patch(`/api/v1/me/history/${rewatch.body.id}`)
        .set(alice.auth)
        .send({ watchedOn: '2025-12-25' })
        .expect(200);
      expect(moved.body.watchedOn).toBe('2025-12-25');

      await t.http().delete(`/api/v1/me/history/${rewatch.body.id}`).set(bob.auth).expect(404);
      await t.http().delete(`/api/v1/me/history/${rewatch.body.id}`).set(alice.auth).expect(204);
    });

    it('computes statistics from the user activity', async () => {
      const stats = await t.http().get('/api/v1/me/stats').set(alice.auth).expect(200);
      expect(stats.body.totals).toMatchObject({
        inCatalog: 3,
        watched: 2,
        wantToWatch: 1,
        favorites: 1,
        rated: 2,
      });
      // Toy Story 10 (updated by the rewatch) and Finding Nemo 7.
      expect(stats.body.averageRating).toBe(8.5);
      expect(stats.body.topGenres[0]).toMatchObject({ id: 16, name: 'Animation', count: 2 });
      expect(stats.body.totalWatchTimeMinutes).toBeGreaterThan(0);
    });

    it('removes a movie from the catalog', async () => {
      await t.http().delete(`/api/v1/me/movies/${INCEPTION}`).set(alice.auth).expect(204);
      await t.http().get(`/api/v1/me/movies/${INCEPTION}`).set(alice.auth).expect(404);
      await t.http().delete(`/api/v1/me/movies/${INCEPTION}`).set(alice.auth).expect(404);
    });

    it('keeps the data in the database (survives restarts)', async () => {
      const rows = await t.db.query(
        `select m.title, um.status, um.notes from user_movies um join movies m on m.id = um.movie_id
         where um.user_id = $1 order by m.title`,
        [alice.id],
      );
      expect(rows.rows).toContainEqual({
        title: 'Toy Story',
        status: 'watched',
        notes: 'Watch with family',
      });
    });
  });

  describe('account', () => {
    it('exports personal data', async () => {
      const response = await t.http().get('/api/v1/me/export').set(alice.auth).expect(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.profile.email).toBe(alice.email);
      expect(response.body.catalog).toContainEqual(
        expect.objectContaining({ title: 'Toy Story', notes: 'Watch with family' }),
      );
    });

    it('deletes the account permanently after re-verifying the email', async () => {
      const doomed = await t.signIn(t.uniqueEmail('doomed'));
      await t.http().put(`/api/v1/me/movies/${TOY_STORY}`).set(doomed.auth).send({}).expect(201);

      await t.http().delete('/api/v1/me').set(doomed.auth).send({ code: '123456' }).expect(401);

      await t.db.query(
        `update auth_otp_state set last_sent_at = now() - interval '2 minutes'
         where email_hash = encode(sha256(convert_to($1, 'utf8')), 'hex')`,
        [doomed.email],
      );
      await t.db.query(
        `update auth.users set recovery_sent_at = now() - interval '2 minutes' where email = $1`,
        [doomed.email],
      );
      const since = new Date();
      await t.http().post('/api/v1/auth/otp').send({ email: doomed.email }).expect(202);
      const code = extractCode(await waitForEmail(doomed.email, { since }));

      await t.http().delete('/api/v1/me').set(doomed.auth).send({ code }).expect(204);

      const profile = await t.db.query('select 1 from profiles where id = $1', [doomed.id]);
      expect(profile.rowCount).toBe(0);
      const entries = await t.db.query('select 1 from user_movies where user_id = $1', [doomed.id]);
      expect(entries.rowCount).toBe(0);
      await t.http().get('/api/v1/me').set(doomed.auth).expect(401);
    });
  });
});
