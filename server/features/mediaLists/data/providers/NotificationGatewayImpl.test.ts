import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { NotificationGatewayImpl } from '@server/features/mediaLists/data/providers/NotificationGatewayImpl';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import notificationManager, { Notification } from '@server/lib/notifications';
import type { NotificationPayload } from '@server/lib/notifications/agents/agent';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

const gateway = new NotificationGatewayImpl();

const ref = (id: number, displayName: string): UserRef => ({
  id,
  displayName,
  avatar: '',
});

const list = (owner: UserRef): MediaList => ({
  id: 1,
  name: 'Sunday Night Sci-Fi',
  description: null,
  owner,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const item: MediaListItem = {
  id: 1,
  listId: 1,
  tmdbId: 693134,
  mediaType: MediaType.MOVIE,
  position: 0,
  status: null,
  addedBy: null,
  pinnedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const capture = () => {
  const calls: { type: Notification; payload: NotificationPayload }[] = [];
  mock.method(
    notificationManager,
    'sendNotification',
    (type: Notification, payload: NotificationPayload) => {
      calls.push({ type, payload });
    }
  );
  return calls;
};

describe('NotificationGatewayImpl', () => {
  setupTestDb();

  beforeEach(() => {
    mock.restoreAll();
  });

  const realUsers = async () => {
    const repository = getRepository(User);
    const owner = await repository.findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const friend = await repository.findOneOrFail({
      where: { email: 'friend@seerr.dev' },
    });
    return { owner, friend };
  };

  describe('notifyListShared', () => {
    it('addresses the recipient and describes write access', async () => {
      const calls = capture();
      const { owner, friend } = await realUsers();

      await gateway.notifyListShared({
        list: list(ref(owner.id, 'owner')),
        recipient: ref(friend.id, 'friend'),
        role: CollaboratorRole.WRITE,
        invitedBy: ref(owner.id, 'owner'),
      });

      assert.strictEqual(calls.length, 1);
      const [{ type, payload }] = calls;
      assert.strictEqual(type, Notification.MEDIA_LIST_SHARED);
      assert.strictEqual(payload.notifyUser?.id, friend.id);
      assert.strictEqual(payload.subject, 'Sunday Night Sci-Fi');
      assert.match(payload.message ?? '', /add and remove titles/);
      assert.deepStrictEqual(
        payload.extra?.find((entry) => entry.name === 'Access offered'),
        { name: 'Access offered', value: 'Can edit' }
      );
      // These are person to person, so the admin fan-out stays off.
      assert.strictEqual(payload.notifyAdmin, false);
    });

    it('describes read access differently', async () => {
      const calls = capture();
      const { owner, friend } = await realUsers();

      await gateway.notifyListShared({
        list: list(ref(owner.id, 'owner')),
        recipient: ref(friend.id, 'friend'),
        role: CollaboratorRole.READ,
        invitedBy: ref(owner.id, 'owner'),
      });

      assert.match(calls[0].payload.message ?? '', /view it/);
      assert.deepStrictEqual(
        calls[0].payload.extra?.find(
          (entry) => entry.name === 'Access offered'
        ),
        { name: 'Access offered', value: 'Can view' }
      );
    });

    // A recipient deleted between the share and the notification must not take down the
    // share itself, which has already been written.
    it('stays quiet when the recipient no longer exists', async () => {
      const calls = capture();
      const { owner } = await realUsers();

      await gateway.notifyListShared({
        list: list(ref(owner.id, 'owner')),
        recipient: ref(9999, 'ghost'),
        role: CollaboratorRole.READ,
        invitedBy: ref(owner.id, 'owner'),
      });

      assert.strictEqual(calls.length, 0);
    });
  });

  describe('notifyItemAdded', () => {
    it('sends one notification per recipient', async () => {
      const calls = capture();
      const { owner, friend } = await realUsers();

      await gateway.notifyItemAdded({
        list: list(ref(owner.id, 'owner')),
        item,
        addedBy: ref(friend.id, 'friend'),
        recipients: [ref(owner.id, 'owner'), ref(friend.id, 'friend')],
      });

      assert.strictEqual(calls.length, 2);
      assert.deepStrictEqual(
        calls.map((call) => call.payload.notifyUser?.id).sort(),
        [owner.id, friend.id].sort()
      );
      assert.strictEqual(calls[0].type, Notification.MEDIA_LIST_ITEM_ADDED);
      assert.match(calls[0].payload.message ?? '', /friend added a title/);
    });

    it('skips recipients that no longer exist', async () => {
      const calls = capture();
      const { owner } = await realUsers();

      await gateway.notifyItemAdded({
        list: list(ref(owner.id, 'owner')),
        item,
        addedBy: ref(owner.id, 'owner'),
        recipients: [ref(owner.id, 'owner'), ref(9999, 'ghost')],
      });

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].payload.notifyUser?.id, owner.id);
    });

    it('sends nothing when there is nobody to tell', async () => {
      const calls = capture();
      const { owner } = await realUsers();

      await gateway.notifyItemAdded({
        list: list(ref(owner.id, 'owner')),
        item,
        addedBy: ref(owner.id, 'owner'),
        recipients: [],
      });

      assert.strictEqual(calls.length, 0);
    });
  });
});
