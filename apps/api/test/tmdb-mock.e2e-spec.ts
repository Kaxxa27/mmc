import { MaintenanceJobs } from '../src/jobs/maintenance.jobs.js';
import { TestApp, type TestUser } from './utils/test-app.js';

// Run this file against the built-in mock TMDB dataset instead of the offline catalog.
process.env.TMDB_MODE = 'mock';

const LIGHTHOUSE = 900_000_001; // fictional, released 4 days from today
const INCEPTION = 27205;

interface Item {
  tmdbId: number;
  title: string;
  releaseDate: string;
}

describe('Movie data from the mock TMDB dataset (e2e)', () => {
  let t: TestApp;
  let user: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
    user = await t.signInWithProfile('Mila');
  });

  afterAll(async () => {
    await t.close();
  });

  it('reports mock mode', async () => {
    const health = await t.http().get('/api/v1/health').expect(200);
    expect(health.body.checks.tmdb).toBe('mock');
    const config = await t.http().get('/api/v1/config').expect(200);
    expect(config.body.movieData).toMatchObject({ mode: 'mock' });
    expect(config.body.movieData.imageBaseUrl).toContain('/api/v1/mock-tmdb/images');
  });

  it('serves every discovery list through the TMDB code path', async () => {
    for (const list of ['popular', 'trending', 'top-rated', 'upcoming', 'now-playing']) {
      const response = await t.http().get(`/api/v1/movies/lists/${list}`).expect(200);
      expect(response.body.source).toBe('tmdb');
      expect(response.body.items.length).toBeGreaterThan(0);
    }
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = await t.http().get('/api/v1/movies/lists/upcoming').expect(200);
    expect(upcoming.body.items.every((m: Item) => m.releaseDate > today)).toBe(true);
  });

  it('searches in other languages and localises the results', async () => {
    const response = await t
      .http()
      .get('/api/v1/movies/search')
      .query({ query: 'унесённые', language: 'ru-RU' })
      .expect(200);
    expect(response.body.items.map((m: Item) => m.title)).toEqual(['Унесённые призраками']);
  });

  it('shows full movie details with cast, trailers, age rating and providers', async () => {
    const response = await t
      .http()
      .get(`/api/v1/movies/${INCEPTION}?region=GB`)
      .set(user.auth)
      .expect(200);
    expect(response.body).toMatchObject({
      title: 'Inception',
      runtime: 148,
      certification: '12A',
      source: 'tmdb',
      crew: { directors: [{ name: 'Christopher Nolan' }] },
      watchProviders: { region: 'GB', subscription: [{ name: 'Max' }] },
    });
    expect(response.body.cast[0]).toMatchObject({
      name: 'Leonardo DiCaprio',
      character: 'Dom Cobb',
    });
    expect(response.body.videos[0]).toMatchObject({ site: 'YouTube', type: 'Trailer' });
    expect(response.body.recommendations.map((m: Item) => m.title)).toContain('Interstellar');
    expect(response.body.posterUrl).toMatch(/\/mock-tmdb\/images\/w500\/mock\/poster\/27205\.svg$/);
  });

  it('serves the placeholder images', async () => {
    const image = await t
      .http()
      .get('/api/v1/mock-tmdb/images/w500/mock/poster/27205.svg')
      .buffer(true)
      .parse((res, done) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => done(null, data));
      })
      .expect(200);
    expect(image.headers['content-type']).toContain('image/svg+xml');
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(image.body).toContain('Inception');
    await t.http().get('/api/v1/mock-tmdb/images/w500/mock/poster/../../etc.svg').expect(404);
  });

  it('finds people and filters movies by cast', async () => {
    const people = await t.http().get('/api/v1/people/search?query=tom hanks').expect(200);
    const hanks = people.body.items[0];
    expect(hanks).toMatchObject({ name: 'Tom Hanks', knownForDepartment: 'Acting' });

    const person = await t.http().get(`/api/v1/people/${hanks.tmdbId}`).expect(200);
    expect(person.body.acting.map((m: Item) => m.title).sort()).toEqual([
      'Forrest Gump',
      'Toy Story',
    ]);

    const discover = await t
      .http()
      .get(`/api/v1/movies/discover?castIds=${hanks.tmdbId}&sort=newest`)
      .expect(200);
    expect(discover.body.items.map((m: Item) => m.title)).toEqual(['Toy Story', 'Forrest Gump']);

    const combined = await t.http().get('/api/v1/search?query=nolan').expect(200);
    expect(combined.body.people.map((p: { name: string }) => p.name)).toContain(
      'Christopher Nolan',
    );
  });

  it('lists genres in the requested language', async () => {
    const response = await t.http().get('/api/v1/genres?language=ru-RU').expect(200);
    expect(response.body.genres).toContainEqual({ id: 16, name: 'Мультфильм' });
  });

  it('imports a mock-only movie into the catalog and reminds about its release', async () => {
    const added = await t
      .http()
      .put(`/api/v1/me/movies/${LIGHTHOUSE}`)
      .set(user.auth)
      .send({})
      .expect(201);
    expect(added.body.movie).toMatchObject({
      title: "The Lighthouse Keeper's Daughter",
      runtime: 118,
    });

    await t.app.get(MaintenanceJobs).sendReleaseReminders();
    const inbox = await t.http().get('/api/v1/me/notifications').set(user.auth).expect(200);
    const reminder = inbox.body.items.find(
      (n: { type: string }) => n.type === 'watchlist_release_upcoming',
    );
    expect(reminder?.title).toContain("The Lighthouse Keeper's Daughter");
  });

  it('fills every section of the home page', async () => {
    const home = await t.http().get('/api/v1/home').set(user.auth).expect(200);
    const keys = home.body.sections.map((s: { key: string }) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining(['trending', 'popular', 'top-rated', 'now-playing', 'upcoming']),
    );
  });
});
