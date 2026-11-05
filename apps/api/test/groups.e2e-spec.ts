import { extractLink, waitForEmail } from './utils/mailpit.js';
import { TestApp, type TestUser } from './utils/test-app.js';

const TOY_STORY = 862;
const COCO = 354912;
const UP = 14160;

describe('Family groups and shared catalog (e2e)', () => {
  let t: TestApp;
  let owner: TestUser;
  let invitee: TestUser;
  let stranger: TestUser;
  let groupId: string;

  beforeAll(async () => {
    t = await TestApp.create();
    owner = await t.signInWithProfile('Olivia');
    stranger = await t.signInWithProfile('Steve');
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates a family group with the creator as owner', async () => {
    const response = await t
      .http()
      .post('/api/v1/groups')
      .set(owner.auth)
      .send({ name: 'The Smiths', kind: 'family', description: 'Friday movie nights' })
      .expect(201);
    groupId = response.body.id;
    expect(response.body).toMatchObject({
      name: 'The Smiths',
      myRole: 'owner',
      memberCount: 1,
      members: [{ id: owner.id, displayName: 'Olivia', role: 'owner' }],
    });
  });

  it('invites a new person by email who signs up and joins', async () => {
    const email = t.uniqueEmail('ivy');
    const since = new Date();
    const invitation = await t
      .http()
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set(owner.auth)
      .send({ email })
      .expect(201);
    expect(invitation.body).toMatchObject({
      kind: 'email',
      email,
      status: 'pending',
      role: 'member',
    });

    const mail = await waitForEmail(email, { since, subjectIncludes: 'invited you' });
    const link = extractLink(mail, '/invitations/');
    const token = decodeURIComponent(link.split('/invitations/')[1]!);

    const preview = await t.http().get(`/api/v1/invitations/${token}`).expect(200);
    expect(preview.body).toMatchObject({
      status: 'pending',
      group: { name: 'The Smiths', memberCount: 1 },
      invitedBy: { displayName: 'Olivia' },
      emailHint: `${email[0]}***@example.com`,
    });

    // A different account cannot use an invitation sent to someone else.
    const mismatch = await t
      .http()
      .post(`/api/v1/invitations/${token}/accept`)
      .set(stranger.auth)
      .expect(403);
    expect(mismatch.body.code).toBe('INVITATION_EMAIL_MISMATCH');

    invitee = await t.signIn(email);
    await t
      .http()
      .post('/api/v1/me/onboarding')
      .set(invitee.auth)
      .send({ firstName: 'Ivy', favoriteGenreIds: [16] })
      .expect(200);
    const accepted = await t
      .http()
      .post(`/api/v1/invitations/${token}/accept`)
      .set(invitee.auth)
      .expect(200);
    expect(accepted.body).toEqual({ groupId, joined: true });

    const reused = await t
      .http()
      .post(`/api/v1/invitations/${token}/accept`)
      .set(invitee.auth)
      .expect(200);
    expect(reused.body.joined).toBe(false);

    const notifications = await t
      .http()
      .get('/api/v1/me/notifications')
      .set(owner.auth)
      .expect(200);
    expect(notifications.body.items[0]).toMatchObject({
      type: 'group_member_joined',
      title: 'Ivy joined The Smiths',
    });
  });

  it('keeps groups private to their members', async () => {
    await t.http().get(`/api/v1/groups/${groupId}`).set(stranger.auth).expect(404);
    await t.http().get(`/api/v1/groups/${groupId}/movies`).set(stranger.auth).expect(404);
    await t
      .http()
      .post(`/api/v1/groups/${groupId}/movies`)
      .set(stranger.auth)
      .send({ tmdbId: UP })
      .expect(404);
    const strangersGroups = await t.http().get('/api/v1/groups').set(stranger.auth).expect(200);
    expect(strangersGroups.body).toEqual([]);
  });

  it('shares a catalog where each member keeps a personal status', async () => {
    await t
      .http()
      .post(`/api/v1/groups/${groupId}/movies`)
      .set(owner.auth)
      .send({ tmdbId: TOY_STORY })
      .expect(201);
    await t
      .http()
      .post(`/api/v1/groups/${groupId}/movies`)
      .set(invitee.auth)
      .send({ tmdbId: COCO, note: 'For the kids' })
      .expect(201);
    const duplicate = await t
      .http()
      .post(`/api/v1/groups/${groupId}/movies`)
      .set(invitee.auth)
      .send({ tmdbId: COCO });
    expect(duplicate.status).toBe(409);

    // Olivia has watched Toy Story; Ivy has not.
    await t
      .http()
      .put(`/api/v1/me/movies/${TOY_STORY}`)
      .set(owner.auth)
      .send({ status: 'watched' })
      .expect(201);
    await t
      .http()
      .put(`/api/v1/me/movies/${TOY_STORY}`)
      .set(invitee.auth)
      .send({ status: 'want_to_watch' })
      .expect(201);

    const catalog = await t
      .http()
      .get(`/api/v1/groups/${groupId}/movies?sort=title_asc`)
      .set(invitee.auth)
      .expect(200);
    expect(catalog.body.total).toBe(2);
    const toyStory = catalog.body.items.find(
      (i: { movie: { tmdbId: number } }) => i.movie.tmdbId === TOY_STORY,
    );
    expect(toyStory.members).toEqual(
      expect.arrayContaining([
        { userId: owner.id, displayName: 'Olivia', status: 'watched' },
        { userId: invitee.id, displayName: 'Ivy', status: 'want_to_watch' },
      ]),
    );

    const ownersEntry = await t
      .http()
      .get(`/api/v1/me/movies/${TOY_STORY}`)
      .set(owner.auth)
      .expect(200);
    expect(ownersEntry.body.status).toBe('watched');
  });

  it('computes the group rating from member ratings', async () => {
    await t
      .http()
      .put(`/api/v1/groups/${groupId}/movies/${TOY_STORY}/rating`)
      .set(owner.auth)
      .send({ rating: 9 })
      .expect(200);
    const rated = await t
      .http()
      .put(`/api/v1/groups/${groupId}/movies/${TOY_STORY}/rating`)
      .set(invitee.auth)
      .send({ rating: 6, review: 'Cute!' })
      .expect(200);
    expect(rated.body.groupRating).toEqual({ average: 7.5, count: 2, mine: 6 });
    expect(rated.body.ratings).toHaveLength(2);

    // Group ratings do not touch personal ratings.
    const personal = await t
      .http()
      .get(`/api/v1/me/movies/${TOY_STORY}`)
      .set(invitee.auth)
      .expect(200);
    expect(personal.body.rating).toBeNull();
  });

  it('marks a movie as watched together', async () => {
    const response = await t
      .http()
      .patch(`/api/v1/groups/${groupId}/movies/${TOY_STORY}`)
      .set(invitee.auth)
      .send({ status: 'watched' })
      .expect(200);
    expect(response.body.status).toBe('watched');
    expect(response.body.watchedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('notifies members mentioned in comments', async () => {
    const username = `olivia_${Date.now().toString(36)}`;
    await t.http().patch('/api/v1/me').set(owner.auth).send({ username }).expect(200);
    const comment = await t
      .http()
      .post(`/api/v1/groups/${groupId}/movies/${COCO}/comments`)
      .set(invitee.auth)
      .send({ body: `@${username} can we watch this on Friday?` })
      .expect(201);
    expect(comment.body).toMatchObject({ author: { displayName: 'Ivy' }, canEdit: true });

    const inbox = await t
      .http()
      .get('/api/v1/me/notifications?unreadOnly=true')
      .set(owner.auth)
      .expect(200);
    expect(inbox.body.items.map((n: { type: string }) => n.type)).toContain('comment_mention');

    const list = await t
      .http()
      .get(`/api/v1/groups/${groupId}/movies/${COCO}/comments`)
      .set(owner.auth)
      .expect(200);
    expect(list.body.items[0]).toMatchObject({ canEdit: false, canDelete: true });
    await t
      .http()
      .patch(`/api/v1/groups/${groupId}/comments/${comment.body.id}`)
      .set(owner.auth)
      .send({ body: 'hacked' })
      .expect(403);
  });

  it('enforces roles and permissions', async () => {
    const forbiddenInvite = await t
      .http()
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set(invitee.auth)
      .send({ email: t.uniqueEmail('x') })
      .expect(403);
    expect(forbiddenInvite.body.code).toBe('GROUP_PERMISSION_DENIED');

    await t
      .http()
      .patch(`/api/v1/groups/${groupId}`)
      .set(invitee.auth)
      .send({ name: 'Mine now' })
      .expect(403);
    await t
      .http()
      .delete(`/api/v1/groups/${groupId}/movies/${TOY_STORY}`)
      .set(invitee.auth)
      .expect(403);

    const promoted = await t
      .http()
      .patch(`/api/v1/groups/${groupId}/members/${invitee.id}`)
      .set(owner.auth)
      .send({ role: 'admin' })
      .expect(200);
    expect(promoted.body.find((m: { id: string }) => m.id === invitee.id).role).toBe('admin');

    await t
      .http()
      .delete(`/api/v1/groups/${groupId}/members/${owner.id}`)
      .set(invitee.auth)
      .expect(403);
    const leaving = await t
      .http()
      .post(`/api/v1/groups/${groupId}/leave`)
      .set(owner.auth)
      .expect(409);
    expect(leaving.body.code).toBe('OWNER_CANNOT_LEAVE');
  });

  it('limits invitation links by number of uses', async () => {
    const link = await t
      .http()
      .post(`/api/v1/groups/${groupId}/invitation-links`)
      .set(invitee.auth)
      .send({ maxUses: 1, expiresInDays: 3 })
      .expect(201);
    expect(link.body.url).toContain('/invitations/');

    await t
      .http()
      .post(`/api/v1/invitations/${link.body.token}/accept`)
      .set(stranger.auth)
      .expect(200);
    const preview = await t.http().get(`/api/v1/invitations/${link.body.token}`).expect(200);
    expect(preview.body.status).toBe('exhausted');

    const latecomer = await t.signInWithProfile('Lara');
    const late = await t
      .http()
      .post(`/api/v1/invitations/${link.body.token}/accept`)
      .set(latecomer.auth)
      .expect(410);
    expect(late.body.code).toBe('INVITATION_USED');

    await t
      .http()
      .delete(`/api/v1/groups/${groupId}/members/${stranger.id}`)
      .set(owner.auth)
      .expect(204);
  });

  it('transfers ownership, archives the group and keeps it read-only', async () => {
    const transferred = await t
      .http()
      .post(`/api/v1/groups/${groupId}/transfer-ownership`)
      .set(owner.auth)
      .send({ userId: invitee.id })
      .expect(200);
    expect(transferred.body.myRole).toBe('admin');

    const archived = await t
      .http()
      .post(`/api/v1/groups/${groupId}/archive`)
      .set(invitee.auth)
      .expect(200);
    expect(archived.body.archived).toBe(true);

    const blocked = await t
      .http()
      .post(`/api/v1/groups/${groupId}/movies`)
      .set(owner.auth)
      .send({ tmdbId: UP })
      .expect(403);
    expect(blocked.body.code).toBe('GROUP_ARCHIVED');
    await t.http().get(`/api/v1/groups/${groupId}/movies`).set(owner.auth).expect(200);

    await t.http().post(`/api/v1/groups/${groupId}/restore`).set(invitee.auth).expect(200);
    await t.http().post(`/api/v1/groups/${groupId}/leave`).set(owner.auth).expect(204);
    await t.http().get(`/api/v1/groups/${groupId}`).set(owner.auth).expect(404);
  });
});
