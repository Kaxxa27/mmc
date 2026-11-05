import { TestApp, type TestUser } from './utils/test-app.js';

const ELF = 10719;
const HOME_ALONE = 771;
const KLAUS = 508965;
const LOVE_ACTUALLY = 508;

describe('Collections and reviews (e2e)', () => {
  let t: TestApp;
  let owner: TestUser;
  let friend: TestUser;
  let stranger: TestUser;
  let groupId: string;

  beforeAll(async () => {
    t = await TestApp.create();
    [owner, friend, stranger] = await Promise.all([
      t.signInWithProfile('Clara'),
      t.signInWithProfile('Finn'),
      t.signInWithProfile('Sam'),
    ]);
    const group = await t
      .http()
      .post('/api/v1/groups')
      .set(owner.auth)
      .send({ name: 'Movie Club', kind: 'friends' })
      .expect(201);
    groupId = group.body.id;
    const link = await t
      .http()
      .post(`/api/v1/groups/${groupId}/invitation-links`)
      .set(owner.auth)
      .send({})
      .expect(201);
    await t
      .http()
      .post(`/api/v1/invitations/${link.body.token}/accept`)
      .set(friend.auth)
      .expect(200);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('collections', () => {
    let collectionId: string;

    it('creates a private collection and manages its movies', async () => {
      const created = await t
        .http()
        .post('/api/v1/collections')
        .set(owner.auth)
        .send({ name: 'Christmas Movies', description: 'Every December' })
        .expect(201);
      collectionId = created.body.id;
      expect(created.body).toMatchObject({
        visibility: 'private',
        itemCount: 0,
        permissions: { canEdit: true, canManage: true },
      });

      for (const tmdbId of [ELF, HOME_ALONE, KLAUS]) {
        await t
          .http()
          .post(`/api/v1/collections/${collectionId}/items`)
          .set(owner.auth)
          .send({ tmdbId })
          .expect(201);
      }
      await t
        .http()
        .post(`/api/v1/collections/${collectionId}/items`)
        .set(owner.auth)
        .send({ tmdbId: ELF })
        .expect(409);

      const reordered = await t
        .http()
        .put(`/api/v1/collections/${collectionId}/items/order`)
        .set(owner.auth)
        .send({ tmdbIds: [KLAUS, ELF] })
        .expect(200);
      expect(
        reordered.body.items.map((i: { movie: { tmdbId: number } }) => i.movie.tmdbId),
      ).toEqual([KLAUS, ELF, HOME_ALONE]);
      expect(reordered.body.itemCount).toBe(3);

      await t
        .http()
        .delete(`/api/v1/collections/${collectionId}/items/${HOME_ALONE}`)
        .set(owner.auth)
        .expect(204);
      const mine = await t.http().get('/api/v1/collections').set(owner.auth).expect(200);
      expect(mine.body.items[0]).toMatchObject({ name: 'Christmas Movies', itemCount: 2 });
    });

    it('keeps private collections private', async () => {
      await t.http().get(`/api/v1/collections/${collectionId}`).set(friend.auth).expect(404);
      await t.http().get(`/api/v1/public/collections/${collectionId}`).expect(404);
      await t
        .http()
        .post(`/api/v1/collections/${collectionId}/items`)
        .set(friend.auth)
        .send({ tmdbId: LOVE_ACTUALLY })
        .expect(404);
    });

    it('shares a collection with a group (read-only for members)', async () => {
      const shares = await t
        .http()
        .post(`/api/v1/collections/${collectionId}/shares`)
        .set(owner.auth)
        .send({ groupId })
        .expect(201);
      expect(shares.body[0].group).toEqual({ id: groupId, name: 'Movie Club' });

      const asFriend = await t
        .http()
        .get(`/api/v1/collections/${collectionId}`)
        .set(friend.auth)
        .expect(200);
      expect(asFriend.body).toMatchObject({
        visibility: 'shared',
        permissions: { canEdit: false, canManage: false },
      });
      const sharedWithMe = await t
        .http()
        .get('/api/v1/collections?scope=shared')
        .set(friend.auth)
        .expect(200);
      expect(sharedWithMe.body.items.map((c: { id: string }) => c.id)).toContain(collectionId);

      await t.http().get(`/api/v1/collections/${collectionId}`).set(stranger.auth).expect(404);
      await t
        .http()
        .patch(`/api/v1/collections/${collectionId}`)
        .set(friend.auth)
        .send({ name: 'Mine' })
        .expect(404);
    });

    it('publishes a collection to anyone with the link', async () => {
      await t
        .http()
        .patch(`/api/v1/collections/${collectionId}`)
        .set(owner.auth)
        .send({ visibility: 'public' })
        .expect(200);
      const anonymous = await t
        .http()
        .get(`/api/v1/public/collections/${collectionId}`)
        .expect(200);
      expect(anonymous.body).toMatchObject({
        name: 'Christmas Movies',
        owner: { displayName: 'Clara' },
      });
      expect(anonymous.body.owner).not.toHaveProperty('email');
    });

    it('lets every member edit a group collection', async () => {
      const groupCollection = await t
        .http()
        .post('/api/v1/collections')
        .set(friend.auth)
        .send({ name: 'Weekend Movie Night', groupId })
        .expect(201);
      expect(groupCollection.body).toMatchObject({ visibility: 'shared', group: { id: groupId } });

      const added = await t
        .http()
        .post(`/api/v1/collections/${groupCollection.body.id}/items`)
        .set(owner.auth)
        .send({ tmdbId: KLAUS, note: 'Perfect for December' })
        .expect(201);
      expect(added.body.items[0]).toMatchObject({
        note: 'Perfect for December',
        addedBy: { displayName: 'Clara' },
      });

      const groupList = await t
        .http()
        .get(`/api/v1/collections?scope=group&groupId=${groupId}`)
        .set(owner.auth)
        .expect(200);
      expect(groupList.body.total).toBe(1);
      await t
        .http()
        .get(`/api/v1/collections/${groupCollection.body.id}`)
        .set(stranger.auth)
        .expect(404);

      const invalid = await t
        .http()
        .post('/api/v1/collections')
        .set(friend.auth)
        .send({ name: 'Nope', groupId, visibility: 'private' })
        .expect(400);
      expect(invalid.body.code).toBe('INVALID_VISIBILITY');
    });

    it('deletes a collection', async () => {
      await t.http().delete(`/api/v1/collections/${collectionId}`).set(owner.auth).expect(204);
      await t.http().get(`/api/v1/collections/${collectionId}`).set(owner.auth).expect(404);
    });
  });

  describe('reviews', () => {
    it('keeps reviews private until published', async () => {
      const review = await t
        .http()
        .put(`/api/v1/me/reviews/${ELF}`)
        .set(owner.auth)
        .send({ body: 'A Christmas classic.', rating: 8, containsSpoilers: false })
        .expect(201);
      expect(review.body).toMatchObject({ isPublic: false, publishedAt: null, rating: 8 });

      const catalog = await t.http().get(`/api/v1/me/movies/${ELF}`).set(owner.auth).expect(200);
      expect(catalog.body).toMatchObject({ status: 'watched', rating: 8 });

      const before = await t.http().get(`/api/v1/movies/${ELF}/reviews`).expect(200);
      expect(before.body.total).toBe(0);

      const published = await t
        .http()
        .put(`/api/v1/me/reviews/${ELF}`)
        .set(owner.auth)
        .send({
          body: 'A Christmas classic. Watch it every year!',
          isPublic: true,
          containsSpoilers: true,
        })
        .expect(200);
      expect(published.body.publishedAt).not.toBeNull();

      const after = await t.http().get(`/api/v1/movies/${ELF}/reviews`).expect(200);
      expect(after.body.items[0]).toMatchObject({
        author: { displayName: 'Clara' },
        containsSpoilers: true,
        body: 'A Christmas classic. Watch it every year!',
      });
      expect(after.body.items[0].author).not.toHaveProperty('email');

      await t.http().get(`/api/v1/me/reviews/${ELF}`).set(friend.auth).expect(404);
      await t.http().delete(`/api/v1/me/reviews/${ELF}`).set(owner.auth).expect(204);
      const gone = await t.http().get(`/api/v1/movies/${ELF}/reviews`).expect(200);
      expect(gone.body.total).toBe(0);
    });
  });
});
