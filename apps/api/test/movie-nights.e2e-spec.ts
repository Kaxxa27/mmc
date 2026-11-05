import { TestApp, type TestUser } from './utils/test-app.js';

// Sample movies (runtime, TMDB rating, US certification, genres):
const TOY_STORY = 862; // 81 min, 8.0, G, animation/comedy
const COCO = 354912; // 105 min, 8.2, PG, animation
const UP = 14160; // 96 min, 8.0, PG, animation/comedy
const FINDING_NEMO = 12; // 100 min, 7.8, G, animation (everyone has seen it)
const INCEPTION = 27205; // 148 min, PG-13, sci-fi
const DIE_HARD = 562; // R, action

interface Candidate {
  movie: { tmdbId: number; title: string };
  votes: number;
  voters: { displayName: string }[] | null;
}

describe('Movie Night Planner (e2e)', () => {
  let t: TestApp;
  let mia: TestUser;
  let noah: TestUser;
  let emma: TestUser;
  let outsider: TestUser;
  let groupId: string;
  let nightId: string;

  beforeAll(async () => {
    t = await TestApp.create();
    [mia, noah, emma, outsider] = await Promise.all([
      t.signInWithProfile('Mia'),
      t.signInWithProfile('Noah'),
      t.signInWithProfile('Emma'),
      t.signInWithProfile('Otto'),
    ]);
    const group = await t
      .http()
      .post('/api/v1/groups')
      .set(mia.auth)
      .send({ name: 'Family Night' })
      .expect(201);
    groupId = group.body.id;
    const link = await t
      .http()
      .post(`/api/v1/groups/${groupId}/invitation-links`)
      .set(mia.auth)
      .send({})
      .expect(201);
    for (const member of [noah, emma]) {
      await t
        .http()
        .post(`/api/v1/invitations/${link.body.token}/accept`)
        .set(member.auth)
        .expect(200);
    }
    for (const tmdbId of [TOY_STORY, COCO, UP, FINDING_NEMO, INCEPTION, DIE_HARD]) {
      await t
        .http()
        .post(`/api/v1/groups/${groupId}/movies`)
        .set(mia.auth)
        .send({ tmdbId })
        .expect(201);
    }
    for (const member of [mia, noah, emma]) {
      await t
        .http()
        .put(`/api/v1/me/movies/${FINDING_NEMO}`)
        .set(member.auth)
        .send({ status: 'watched' })
        .expect(201);
    }
    await t
      .http()
      .put(`/api/v1/me/movies/${TOY_STORY}`)
      .set(noah.auth)
      .send({ status: 'watched' })
      .expect(201);
    await t
      .http()
      .put(`/api/v1/me/movies/${COCO}`)
      .set(emma.auth)
      .send({ status: 'want_to_watch' })
      .expect(201);
    await t
      .http()
      .put(`/api/v1/me/movies/${COCO}`)
      .set(noah.auth)
      .send({ status: 'want_to_watch' })
      .expect(201);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates a movie night for the whole group and notifies participants', async () => {
    const response = await t
      .http()
      .post(`/api/v1/groups/${groupId}/movie-nights`)
      .set(mia.auth)
      .send({
        title: 'Friday family night',
        scheduledAt: new Date(Date.now() + 2 * 86400_000).toISOString(),
        criteria: { genreIds: [35, 16], maxRuntime: 120, minRating: 7, maxCertification: 'PG' },
      })
      .expect(201);
    nightId = response.body.id;
    expect(response.body).toMatchObject({
      status: 'planning',
      participantCount: 3,
      permissions: { canManage: true, isParticipant: true },
      criteria: { maxRuntime: 120, maxCertification: 'PG' },
    });

    const inbox = await t.http().get('/api/v1/me/notifications').set(noah.auth).expect(200);
    expect(inbox.body.items[0]).toMatchObject({
      type: 'movie_night_scheduled',
      data: { movieNightId: nightId },
    });
  });

  it('hides the movie night from people outside the group', async () => {
    await t.http().get(`/api/v1/movie-nights/${nightId}`).set(outsider.auth).expect(404);
    await t.http().get(`/api/v1/groups/${groupId}/movie-nights`).set(outsider.auth).expect(404);
  });

  it('suggests matching movies from the shared watchlist', async () => {
    const response = await t
      .http()
      .get(`/api/v1/movie-nights/${nightId}/suggestions`)
      .set(emma.auth)
      .expect(200);
    const ids = response.body.map((s: { movie: { tmdbId: number } }) => s.movie.tmdbId);
    // Inception (too long, PG-13), Die Hard (R) and Finding Nemo (everyone saw it) are filtered out.
    expect(ids.sort()).toEqual([TOY_STORY, COCO, UP].sort());
    // Coco is wanted by two participants, so it ranks first.
    expect(response.body[0]).toMatchObject({ movie: { tmdbId: COCO }, wantedBy: 2 });
  });

  it('runs a vote and selects the winner', async () => {
    const withCandidates = await t
      .http()
      .post(`/api/v1/movie-nights/${nightId}/candidates/suggested`)
      .set(mia.auth)
      .send({ limit: 3 })
      .expect(201);
    expect(withCandidates.body.candidates).toHaveLength(3);

    const early = await t
      .http()
      .put(`/api/v1/movie-nights/${nightId}/vote`)
      .set(noah.auth)
      .send({ tmdbId: COCO })
      .expect(409);
    expect(early.body.code).toBe('INVALID_MOVIE_NIGHT_STATE');

    await t.http().post(`/api/v1/movie-nights/${nightId}/voting/start`).set(emma.auth).expect(403);
    await t.http().post(`/api/v1/movie-nights/${nightId}/voting/start`).set(mia.auth).expect(200);

    await t
      .http()
      .put(`/api/v1/movie-nights/${nightId}/vote`)
      .set(mia.auth)
      .send({ tmdbId: COCO })
      .expect(200);
    await t
      .http()
      .put(`/api/v1/movie-nights/${nightId}/vote`)
      .set(noah.auth)
      .send({ tmdbId: UP })
      .expect(200);
    await t
      .http()
      .put(`/api/v1/movie-nights/${nightId}/vote`)
      .set(noah.auth)
      .send({ tmdbId: COCO })
      .expect(200);
    const emmasVote = await t
      .http()
      .put(`/api/v1/movie-nights/${nightId}/vote`)
      .set(emma.auth)
      .send({ tmdbId: UP })
      .expect(200);
    expect(emmasVote.body).toMatchObject({
      votesCast: 3,
      myVoteTmdbId: UP,
      permissions: { canVote: true },
    });
    const coco = emmasVote.body.candidates.find((c: Candidate) => c.movie.tmdbId === COCO);
    expect(coco).toMatchObject({ votes: 2, voters: null });

    await t
      .http()
      .put(`/api/v1/movie-nights/${nightId}/vote`)
      .set(emma.auth)
      .send({ tmdbId: DIE_HARD })
      .expect(400);
    await t
      .http()
      .post(`/api/v1/movie-nights/${nightId}/voting/close`)
      .set(noah.auth)
      .send({})
      .expect(403);

    const decided = await t
      .http()
      .post(`/api/v1/movie-nights/${nightId}/voting/close`)
      .set(mia.auth)
      .send({})
      .expect(200);
    expect(decided.body).toMatchObject({
      status: 'decided',
      decisionMethod: 'vote',
      selectedMovie: { tmdbId: COCO, title: 'Coco' },
    });
    const revealed = decided.body.candidates.find((c: Candidate) => c.movie.tmdbId === COCO);
    expect(revealed.voters.map((v: { displayName: string }) => v.displayName).sort()).toEqual([
      'Mia',
      'Noah',
    ]);

    const inbox = await t.http().get('/api/v1/me/notifications').set(emma.auth).expect(200);
    expect(inbox.body.items.map((n: { type: string }) => n.type)).toEqual(
      expect.arrayContaining(['movie_night_voting_started', 'movie_night_decided']),
    );
  });

  it('completes the night and keeps it in the history', async () => {
    const completed = await t
      .http()
      .post(`/api/v1/movie-nights/${nightId}/complete`)
      .set(mia.auth)
      .expect(200);
    expect(completed.body.status).toBe('completed');

    const groupMovie = await t
      .http()
      .get(`/api/v1/groups/${groupId}/movies/${COCO}`)
      .set(emma.auth)
      .expect(200);
    expect(groupMovie.body.status).toBe('watched');

    const viewing = await t
      .http()
      .post(`/api/v1/movie-nights/${nightId}/log-viewing`)
      .set(noah.auth)
      .send({ rating: 9 })
      .expect(201);
    expect(viewing.body).toMatchObject({
      movie: { tmdbId: COCO },
      rating: 9,
      movieNightId: nightId,
    });

    await t
      .http()
      .put(`/api/v1/groups/${groupId}/movies/${COCO}/rating`)
      .set(noah.auth)
      .send({ rating: 9 })
      .expect(200);
    await t
      .http()
      .put(`/api/v1/groups/${groupId}/movies/${COCO}/rating`)
      .set(emma.auth)
      .send({ rating: 7 })
      .expect(200);

    const history = await t
      .http()
      .get(`/api/v1/groups/${groupId}/movie-nights?when=past`)
      .set(emma.auth)
      .expect(200);
    expect(history.body.items[0]).toMatchObject({
      id: nightId,
      status: 'completed',
      selectedMovie: { tmdbId: COCO },
    });

    const details = await t
      .http()
      .get(`/api/v1/movie-nights/${nightId}`)
      .set(emma.auth)
      .expect(200);
    expect(details.body.finalRatings).toMatchObject({ average: 8 });
  });

  it('picks a movie at random', async () => {
    const night = await t
      .http()
      .post(`/api/v1/groups/${groupId}/movie-nights`)
      .set(noah.auth)
      .send({
        title: 'Surprise me',
        participantIds: [noah.id, emma.id],
        criteria: { genreIds: [16], excludeWatchedBy: 'none' },
      })
      .expect(201);
    expect(night.body.participantCount).toBe(2);

    const picked = await t
      .http()
      .post(`/api/v1/movie-nights/${night.body.id}/pick-random`)
      .set(noah.auth)
      .expect(200);
    expect(picked.body.status).toBe('decided');
    expect(picked.body.decisionMethod).toBe('random');
    expect([TOY_STORY, COCO, UP, FINDING_NEMO]).toContain(picked.body.selectedMovie.tmdbId);

    // Mia is not a participant but, as the group owner, can still manage it.
    const cancelled = await t
      .http()
      .post(`/api/v1/movie-nights/${night.body.id}/cancel`)
      .set(mia.auth)
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });

  it('rejects participants who are not group members', async () => {
    const response = await t
      .http()
      .post(`/api/v1/groups/${groupId}/movie-nights`)
      .set(mia.auth)
      .send({ title: 'Invalid', participantIds: [outsider.id] })
      .expect(400);
    expect(response.body.code).toBe('NOT_GROUP_MEMBERS');
  });

  it('supports comments on a movie night', async () => {
    await t
      .http()
      .post(`/api/v1/movie-nights/${nightId}/comments`)
      .set(emma.auth)
      .send({ body: 'Popcorn is on me!' })
      .expect(201);
    const comments = await t
      .http()
      .get(`/api/v1/movie-nights/${nightId}/comments`)
      .set(mia.auth)
      .expect(200);
    expect(comments.body.items[0]).toMatchObject({
      body: 'Popcorn is on me!',
      author: { displayName: 'Emma' },
    });
    await t
      .http()
      .post(`/api/v1/movie-nights/${nightId}/comments`)
      .set(outsider.auth)
      .send({ body: 'hi' })
      .expect(404);
  });
});
