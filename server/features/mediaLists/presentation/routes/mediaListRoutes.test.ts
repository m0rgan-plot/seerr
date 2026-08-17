import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import mediaListRoutes from '@server/features/mediaLists/presentation/routes';
import notificationManager from '@server/lib/notifications';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';
import request from 'supertest';

let app: Express;

function createApp() {
  const created = express();
  created.use(express.json());
  created.use(
    session({ secret: 'test-secret', resave: false, saveUninitialized: false })
  );
  created.use(checkUser);
  created.use('/auth', authRoutes);
  created.use('/mediaLists', mediaListRoutes);
  created.use(
    (
      err: { status?: number; message?: string; errors?: string[] },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ message: err.message, errors: err.errors });
    }
  );
  return created;
}

before(() => {
  app = createApp();
});

beforeEach(() => {
  mock.restoreAll();
  mock.method(notificationManager, 'sendNotification', () => undefined);
});

setupTestDb();

async function loginAs(email: string) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(app);
    const res = await agent
      .post('/auth/local')
      .send({ email, password: 'test1234' });
    assert.strictEqual(res.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

const asOwner = () => loginAs('admin@seerr.dev');
const asFriend = () => loginAs('friend@seerr.dev');

const friendId = async () =>
  (
    await getRepository(User).findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    })
  ).id;

const ownerId = async () =>
  (
    await getRepository(User).findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    })
  ).id;

async function createList(agent: request.Agent, name = 'Sunday Night Sci-Fi') {
  const res = await agent
    .post('/mediaLists')
    .send({ name, description: 'Slow burn' });
  assert.strictEqual(res.status, 201);
  return res.body;
}

async function shareWith(
  agent: request.Agent,
  listId: number,
  userId: number,
  role: 'read' | 'write'
) {
  const res = await agent
    .post(`/mediaLists/${listId}/collaborators`)
    .send({ userId, role });
  assert.strictEqual(res.status, 201);
  return res.body;
}

// Sharing only creates a pending invite now, so tests that need the invited agent to
// actually have access call this after shareWith, the same way the invited user would
// accept through the UI.
async function acceptInvite(agent: request.Agent, listId: number) {
  const res = await agent.post(`/mediaLists/${listId}/invite/accept`);
  assert.strictEqual(res.status, 200);
  return res.body;
}

async function addMovie(agent: request.Agent, listId: number, tmdbId = 693134) {
  const res = await agent
    .post(`/mediaLists/${listId}/items`)
    .send({ tmdbId, mediaType: MediaType.MOVIE });
  assert.strictEqual(res.status, 201);
  return res.body;
}

describe('media list routes', () => {
  describe('authentication', () => {
    it('rejects an anonymous caller', async () => {
      // The router is mounted behind isAuthenticated in the real app, but every handler
      // still depends on a user being present.
      const res = await request(app).get('/mediaLists');
      assert.strictEqual(res.status, 500);
    });
  });

  describe('POST /mediaLists', () => {
    it('creates a list owned by the caller', async () => {
      const agent = await asOwner();

      const res = await agent
        .post('/mediaLists')
        .send({ name: '  Film club  ', description: '  ' });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.name, 'Film club');
      assert.strictEqual(res.body.description, null);
      assert.strictEqual(res.body.role, 'owner');
    });

    it('rejects a nameless list', async () => {
      const agent = await asOwner();

      const res = await agent.post('/mediaLists').send({ name: '   ' });

      assert.strictEqual(res.status, 400);
    });
  });

  describe('GET /mediaLists', () => {
    it('returns owned and shared lists with the caller role', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'read');
      await acceptInvite(friend, list.id);

      const mine = await owner.get('/mediaLists');
      const theirs = await friend.get('/mediaLists');

      assert.strictEqual(mine.body.length, 1);
      assert.strictEqual(mine.body[0].role, 'owner');
      assert.strictEqual(theirs.body.length, 1);
      assert.strictEqual(theirs.body[0].role, 'read');
    });

    it('summarises counts and preview items', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      await addMovie(owner, list.id, 1);
      const second = await addMovie(owner, list.id, 2);
      await owner.post(`/mediaLists/${list.id}/items/${second.id}/watched`);

      const res = await owner.get('/mediaLists');

      assert.strictEqual(res.body[0].itemCount, 2);
      assert.strictEqual(res.body[0].seenCount, 1);
      assert.deepStrictEqual(
        res.body[0].previewItems.map((item: { tmdbId: number }) => item.tmdbId),
        [1, 2]
      );
    });

    it('never exposes sensitive user fields', async () => {
      const owner = await asOwner();
      await createList(owner);

      const res = await owner.get('/mediaLists');

      const serialised = JSON.stringify(res.body);
      for (const field of ['plexToken', 'password', 'email', 'plexId']) {
        assert.strictEqual(
          serialised.includes(field),
          false,
          `${field} must not be exposed`
        );
      }
    });
  });

  describe('GET /mediaLists/:id', () => {
    it('is visible to the owner and to collaborators', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'read');
      await acceptInvite(friend, list.id);

      assert.strictEqual(
        (await owner.get(`/mediaLists/${list.id}`)).status,
        200
      );
      assert.strictEqual(
        (await friend.get(`/mediaLists/${list.id}`)).status,
        200
      );
    });

    it('is 403 for someone it was not shared with', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);

      const res = await friend.get(`/mediaLists/${list.id}`);

      assert.strictEqual(res.status, 403);
    });

    it('is 404 for a list that does not exist', async () => {
      const owner = await asOwner();

      assert.strictEqual((await owner.get('/mediaLists/9999')).status, 404);
    });
  });

  describe('PUT and DELETE /mediaLists/:id', () => {
    it('lets a write collaborator rename but not delete', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'write');
      await acceptInvite(friend, list.id);

      const renamed = await friend
        .put(`/mediaLists/${list.id}`)
        .send({ name: 'Renamed' });
      const deleted = await friend.delete(`/mediaLists/${list.id}`);

      assert.strictEqual(renamed.status, 200);
      assert.strictEqual(renamed.body.name, 'Renamed');
      // Only the author can delete, however much else they can do.
      assert.strictEqual(deleted.status, 403);
    });

    it('refuses a read collaborator renaming', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'read');
      await acceptInvite(friend, list.id);

      const res = await friend
        .put(`/mediaLists/${list.id}`)
        .send({ name: 'Nope' });

      assert.strictEqual(res.status, 403);
    });

    it('rejects an empty update', async () => {
      const owner = await asOwner();
      const list = await createList(owner);

      const res = await owner.put(`/mediaLists/${list.id}`).send({});

      assert.strictEqual(res.status, 400);
    });

    it('lets the owner delete', async () => {
      const owner = await asOwner();
      const list = await createList(owner);

      assert.strictEqual(
        (await owner.delete(`/mediaLists/${list.id}`)).status,
        204
      );
      assert.strictEqual((await owner.get('/mediaLists')).body.length, 0);
    });
  });

  describe('items', () => {
    it('adds, lists and removes titles', async () => {
      const owner = await asOwner();
      const list = await createList(owner);

      const item = await addMovie(owner, list.id);
      const listed = await owner.get(`/mediaLists/${list.id}/items`);

      assert.strictEqual(listed.status, 200);
      assert.strictEqual(listed.body.length, 1);
      assert.strictEqual(listed.body[0].tmdbId, 693134);
      assert.strictEqual(listed.body[0].watched, false);
      assert.strictEqual(listed.body[0].progress, null);
      assert.deepStrictEqual(listed.body[0].seenBy, []);

      assert.strictEqual(
        (await owner.delete(`/mediaLists/${list.id}/items/${item.id}`)).status,
        204
      );
    });

    it('is 409 on a duplicate title', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      await addMovie(owner, list.id);

      const res = await owner
        .post(`/mediaLists/${list.id}/items`)
        .send({ tmdbId: 693134, mediaType: MediaType.MOVIE });

      assert.strictEqual(res.status, 409);
    });

    it('rejects an unknown media type', async () => {
      const owner = await asOwner();
      const list = await createList(owner);

      const res = await owner
        .post(`/mediaLists/${list.id}/items`)
        .send({ tmdbId: 1, mediaType: 'book' });

      assert.strictEqual(res.status, 400);
    });

    it('refuses a read collaborator adding or removing', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'read');
      await acceptInvite(friend, list.id);
      const item = await addMovie(owner, list.id);

      const added = await friend
        .post(`/mediaLists/${list.id}/items`)
        .send({ tmdbId: 2, mediaType: MediaType.MOVIE });
      const removed = await friend.delete(
        `/mediaLists/${list.id}/items/${item.id}`
      );

      assert.strictEqual(added.status, 403);
      assert.strictEqual(removed.status, 403);
    });

    it('reorders and rejects a partial order', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      const first = await addMovie(owner, list.id, 1);
      const second = await addMovie(owner, list.id, 2);

      const ok = await owner
        .post(`/mediaLists/${list.id}/items/reorder`)
        .send({ orderedItemIds: [second.id, first.id] });
      const partial = await owner
        .post(`/mediaLists/${list.id}/items/reorder`)
        .send({ orderedItemIds: [first.id] });

      assert.strictEqual(ok.status, 204);
      assert.strictEqual(partial.status, 400);

      const listed = await owner.get(`/mediaLists/${list.id}/items`);
      assert.deepStrictEqual(
        listed.body.map((item: { tmdbId: number }) => item.tmdbId),
        [2, 1]
      );
    });
  });

  describe('watched state', () => {
    it('records the caller own state and keeps it off other members', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'read');
      await acceptInvite(friend, list.id);
      const item = await addMovie(owner, list.id);

      // A read-only collaborator may still record what they watched.
      const marked = await friend.post(
        `/mediaLists/${list.id}/items/${item.id}/watched`
      );
      assert.strictEqual(marked.status, 204);

      const forFriend = await friend.get(`/mediaLists/${list.id}/items`);
      const forOwner = await owner.get(`/mediaLists/${list.id}/items`);

      assert.strictEqual(forFriend.body[0].watched, true);
      assert.strictEqual(forOwner.body[0].watched, false);
      // The owner sees who has finished it.
      assert.strictEqual(forOwner.body[0].seenBy.length, 1);
      assert.strictEqual(forOwner.body[0].seenBy[0].id, await friendId());
    });

    // The owner holds no collaborator row, so resolving seen-by against the collaborator
    // table alone drops the badge of the person who created the list.
    it('shows the owner among the members who have seen a title', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'read');
      await acceptInvite(friend, list.id);
      const item = await addMovie(owner, list.id);

      await owner.post(`/mediaLists/${list.id}/items/${item.id}/watched`);

      const forFriend = await friend.get(`/mediaLists/${list.id}/items`);

      assert.deepStrictEqual(
        forFriend.body[0].seenBy.map((member: { id: number }) => member.id),
        [await ownerId()]
      );
    });

    it('unmarks a movie', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      const item = await addMovie(owner, list.id);

      await owner.post(`/mediaLists/${list.id}/items/${item.id}/watched`);
      const cleared = await owner.delete(
        `/mediaLists/${list.id}/items/${item.id}/watched`
      );

      assert.strictEqual(cleared.status, 204);
      const listed = await owner.get(`/mediaLists/${list.id}/items`);
      assert.strictEqual(listed.body[0].watched, false);
    });

    it('refuses the movie action on a series', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      const res = await owner
        .post(`/mediaLists/${list.id}/items`)
        .send({ tmdbId: 125988, mediaType: MediaType.TV });

      const marked = await owner.post(
        `/mediaLists/${list.id}/items/${res.body.id}/watched`
      );

      assert.strictEqual(marked.status, 400);
    });

    it('refuses a stranger', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      const item = await addMovie(owner, list.id);

      const res = await friend.post(
        `/mediaLists/${list.id}/items/${item.id}/watched`
      );

      assert.strictEqual(res.status, 403);
    });

    it('filters items by the caller own state', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      await addMovie(owner, list.id, 1);
      const second = await addMovie(owner, list.id, 2);
      await owner.post(`/mediaLists/${list.id}/items/${second.id}/watched`);

      const seen = await owner.get(`/mediaLists/${list.id}/items?filter=seen`);
      const unseen = await owner.get(
        `/mediaLists/${list.id}/items?filter=unseen`
      );

      assert.deepStrictEqual(
        seen.body.map((item: { tmdbId: number }) => item.tmdbId),
        [2]
      );
      assert.deepStrictEqual(
        unseen.body.map((item: { tmdbId: number }) => item.tmdbId),
        [1]
      );
    });
  });

  describe('collaborators', () => {
    it('shares, changes a role and removes', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      const userId = await friendId();

      const shared = await shareWith(owner, list.id, userId, 'read');
      assert.strictEqual(shared.role, 'read');

      const promoted = await owner
        .put(`/mediaLists/${list.id}/collaborators/${userId}`)
        .send({ role: 'write' });
      assert.strictEqual(promoted.status, 200);
      assert.strictEqual(promoted.body.role, 'write');

      const listed = await owner.get(`/mediaLists/${list.id}/collaborators`);
      assert.strictEqual(listed.body.length, 1);

      const removed = await owner.delete(
        `/mediaLists/${list.id}/collaborators/${userId}`
      );
      assert.strictEqual(removed.status, 204);
    });

    it('refuses to share a list with its own owner', async () => {
      const owner = await asOwner();
      const list = await createList(owner);
      const ownerId = (
        await getRepository(User).findOneOrFail({
          where: { email: 'admin@seerr.dev' },
        })
      ).id;

      const res = await owner
        .post(`/mediaLists/${list.id}/collaborators`)
        .send({ userId: ownerId, role: 'write' });

      assert.strictEqual(res.status, 400);
    });

    it('is 404 for a user that does not exist', async () => {
      const owner = await asOwner();
      const list = await createList(owner);

      const res = await owner
        .post(`/mediaLists/${list.id}/collaborators`)
        .send({ userId: 9999, role: 'read' });

      assert.strictEqual(res.status, 404);
    });

    it('rejects an unknown role', async () => {
      const owner = await asOwner();
      const list = await createList(owner);

      const res = await owner
        .post(`/mediaLists/${list.id}/collaborators`)
        .send({ userId: await friendId(), role: 'admin' });

      assert.strictEqual(res.status, 400);
    });

    // The recipient here does not exist. A non-owner must still be told 403 rather than
    // 404, otherwise telling the two apart reveals which user ids are real.
    it('only lets the owner share, without leaking whether a user exists', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'write');

      const missingUser = await friend
        .post(`/mediaLists/${list.id}/collaborators`)
        .send({ userId: 9999, role: 'read' });
      const realUser = await friend
        .post(`/mediaLists/${list.id}/collaborators`)
        .send({ userId: await friendId(), role: 'read' });

      assert.strictEqual(missingUser.status, 403);
      assert.strictEqual(realUser.status, 403);
    });

    it('lets a collaborator remove themselves', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      const userId = await friendId();
      await shareWith(owner, list.id, userId, 'read');
      await acceptInvite(friend, list.id);

      const left = await friend.delete(
        `/mediaLists/${list.id}/collaborators/${userId}`
      );

      assert.strictEqual(left.status, 204);
      assert.strictEqual((await friend.get('/mediaLists')).body.length, 0);
    });
  });

  describe('invites', () => {
    it('lists a pending invite with an item count and drops it once accepted', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await addMovie(owner, list.id);
      await shareWith(owner, list.id, await friendId(), 'read');

      const before = await friend.get('/mediaLists/invites');
      assert.strictEqual(before.body.length, 1);
      assert.strictEqual(before.body[0].listId, list.id);
      assert.strictEqual(before.body[0].listName, list.name);
      assert.strictEqual(before.body[0].itemCount, 1);
      assert.strictEqual(before.body[0].invitedBy.id, await ownerId());
      // Not accepted yet, so it must not show up as a reachable list either.
      assert.strictEqual((await friend.get('/mediaLists')).body.length, 0);

      await acceptInvite(friend, list.id);

      assert.strictEqual(
        (await friend.get('/mediaLists/invites')).body.length,
        0
      );
      assert.strictEqual((await friend.get('/mediaLists')).body.length, 1);
    });

    it('is final on reject, and a fresh invite can follow', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);
      await shareWith(owner, list.id, await friendId(), 'read');

      const rejected = await friend.post(
        `/mediaLists/${list.id}/invite/reject`
      );
      assert.strictEqual(rejected.status, 204);
      assert.strictEqual(
        (await friend.get('/mediaLists/invites')).body.length,
        0
      );

      // No un-reject: acting on the same invite again is a 404, not idempotent.
      const acceptAfterReject = await friend.post(
        `/mediaLists/${list.id}/invite/accept`
      );
      assert.strictEqual(acceptAfterReject.status, 404);

      // The owner sends a fresh invite, which the friend can accept normally.
      await shareWith(owner, list.id, await friendId(), 'write');
      const reinvited = await friend.get('/mediaLists/invites');
      assert.strictEqual(reinvited.body.length, 1);
      assert.strictEqual(reinvited.body[0].role, 'write');
    });

    it('is 404 for someone with no pending invite', async () => {
      const owner = await asOwner();
      const friend = await asFriend();
      const list = await createList(owner);

      assert.strictEqual(
        (await friend.post(`/mediaLists/${list.id}/invite/accept`)).status,
        404
      );
      assert.strictEqual(
        (await friend.post(`/mediaLists/${list.id}/invite/reject`)).status,
        404
      );
    });
  });
});
