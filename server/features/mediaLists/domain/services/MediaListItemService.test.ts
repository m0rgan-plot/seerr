import { MediaType } from '@server/constants/media';
import {
  DuplicateMediaListItemError,
  InvalidReorderError,
  ItemNotFoundInListError,
  MediaListAccessDeniedError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import {
  OWNER,
  READER,
  STRANGER,
  WRITER,
  buildHarness,
} from '@server/features/mediaLists/domain/test/harness';
import assert from 'node:assert';
import { describe, it } from 'node:test';

const addMovie = (
  harness: ReturnType<typeof buildHarness>,
  listId: number,
  tmdbId: number,
  actor = OWNER
) =>
  harness.itemService.add({
    listId,
    tmdbId,
    mediaType: MediaType.MOVIE,
    actor,
  });

describe('MediaListItemService', () => {
  it('appends items in insertion order', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    await addMovie(harness, list.id, 1);
    await addMovie(harness, list.id, 2);

    const items = await harness.itemService.itemsOf(list.id, OWNER.id);
    assert.deepStrictEqual(
      items.map((item) => item.tmdbId),
      [1, 2]
    );
    assert.deepStrictEqual(
      items.map((item) => item.position),
      [0, 1]
    );
  });

  it('bumps the list updatedAt so the index can sort by last modified', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();
    const before = list.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 5));
    const item = await addMovie(harness, list.id, 1);
    assert.ok(list.updatedAt.getTime() > before);

    const afterAdd = list.updatedAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await harness.itemService.remove(list.id, item.id, OWNER.id);
    assert.ok(list.updatedAt.getTime() > afterAdd);
  });

  it('records who added the item', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    const item = await addMovie(harness, list.id, 1, WRITER);

    assert.strictEqual(item.addedBy?.id, WRITER.id);
  });

  it('rejects the same title twice in one list', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();
    await addMovie(harness, list.id, 693134);

    await assert.rejects(
      () => addMovie(harness, list.id, 693134),
      DuplicateMediaListItemError
    );
  });

  it('treats a movie and a series with the same tmdb id as different titles', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    await addMovie(harness, list.id, 42);
    await harness.itemService.add({
      listId: list.id,
      tmdbId: 42,
      mediaType: MediaType.TV,
      actor: OWNER,
    });

    const items = await harness.itemService.itemsOf(list.id, OWNER.id);
    assert.strictEqual(items.length, 2);
  });

  describe('access', () => {
    it('lets a write collaborator add and remove', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      const item = await addMovie(harness, list.id, 1, WRITER);
      await harness.itemService.remove(list.id, item.id, WRITER.id);

      assert.strictEqual(harness.items.items.length, 0);
    });

    it('refuses a read-only collaborator', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () => addMovie(harness, list.id, 1, READER),
        MediaListAccessDeniedError
      );
    });

    it('refuses a stranger', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () => addMovie(harness, list.id, 1, STRANGER),
        MediaListAccessDeniedError
      );
    });

    it('refuses to remove an item that belongs to another list', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const other = await harness.listService.create({
        name: 'Other',
        ownerId: OWNER.id,
      });
      const item = await addMovie(harness, other.id, 1);

      await assert.rejects(
        () => harness.itemService.remove(list.id, item.id, OWNER.id),
        ItemNotFoundInListError
      );
    });
  });

  describe('notifications', () => {
    it('tells the other members when someone adds a title', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await addMovie(harness, list.id, 1, WRITER);

      assert.strictEqual(harness.notifications.itemsAdded.length, 1);
      const [notification] = harness.notifications.itemsAdded;
      assert.strictEqual(notification.addedBy.id, WRITER.id);
      assert.deepStrictEqual(
        notification.recipients.map((recipient) => recipient.id).sort(),
        [OWNER.id, READER.id]
      );
    });

    it('does not notify anyone about a list nobody else is on', async () => {
      const harness = buildHarness();
      const solo = await harness.listService.create({
        name: 'Just me',
        ownerId: OWNER.id,
      });

      await addMovie(harness, solo.id, 1);

      assert.strictEqual(harness.notifications.itemsAdded.length, 0);
    });
  });

  describe('reorder', () => {
    it('applies a new order', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const first = await addMovie(harness, list.id, 1);
      const second = await addMovie(harness, list.id, 2);
      const third = await addMovie(harness, list.id, 3);

      await harness.itemService.reorder(list.id, OWNER.id, [
        third.id,
        first.id,
        second.id,
      ]);

      const items = await harness.itemService.itemsOf(list.id, OWNER.id);
      assert.deepStrictEqual(
        items.map((item) => item.tmdbId),
        [3, 1, 2]
      );
    });

    // A stale client must not be able to silently drop items out of the ordering.
    it('rejects an order that is not a permutation of the list', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const first = await addMovie(harness, list.id, 1);
      await addMovie(harness, list.id, 2);

      await assert.rejects(
        () => harness.itemService.reorder(list.id, OWNER.id, [first.id]),
        InvalidReorderError
      );
      await assert.rejects(
        () =>
          harness.itemService.reorder(list.id, OWNER.id, [first.id, first.id]),
        InvalidReorderError
      );
    });

    it('refuses a read-only collaborator', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const item = await addMovie(harness, list.id, 1);

      await assert.rejects(
        () => harness.itemService.reorder(list.id, READER.id, [item.id]),
        MediaListAccessDeniedError
      );
    });
  });

  describe('pin', () => {
    it('pins and unpins an item', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const item = await addMovie(harness, list.id, 1);

      await harness.itemService.setPinned(list.id, item.id, OWNER.id, true);
      assert.ok(
        (await harness.itemService.itemsOf(list.id, OWNER.id))[0].pinnedAt
      );

      await harness.itemService.setPinned(list.id, item.id, OWNER.id, false);
      assert.strictEqual(
        (await harness.itemService.itemsOf(list.id, OWNER.id))[0].pinnedAt,
        null
      );
    });

    it('sorts a pinned item ahead of position, most recently pinned first', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const first = await addMovie(harness, list.id, 1);
      await addMovie(harness, list.id, 2);
      const third = await addMovie(harness, list.id, 3);

      await harness.itemService.setPinned(list.id, third.id, OWNER.id, true);

      const items = await harness.itemService.itemsOf(list.id, OWNER.id);
      assert.deepStrictEqual(
        items.map((item) => item.tmdbId),
        [3, 1, 2]
      );
      // Unpinned items keep the manual order underneath the pin.
      assert.strictEqual(items[1].tmdbId, first.tmdbId);
    });

    it('lets a write collaborator pin', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const item = await addMovie(harness, list.id, 1);

      await harness.itemService.setPinned(list.id, item.id, WRITER.id, true);

      assert.ok(
        (await harness.itemService.itemsOf(list.id, OWNER.id))[0].pinnedAt
      );
    });

    it('refuses a read-only collaborator', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const item = await addMovie(harness, list.id, 1);

      await assert.rejects(
        () => harness.itemService.setPinned(list.id, item.id, READER.id, true),
        MediaListAccessDeniedError
      );
    });

    it('refuses to pin an item that belongs to another list', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      const other = await harness.listService.create({
        name: 'Other',
        ownerId: OWNER.id,
      });
      const item = await addMovie(harness, other.id, 1);

      await assert.rejects(
        () => harness.itemService.setPinned(list.id, item.id, OWNER.id, true),
        ItemNotFoundInListError
      );
    });
  });

  describe('itemsContaining', () => {
    it('reports own and shared lists that already hold the title, with the item id', async () => {
      const harness = buildHarness();
      const shared = await harness.seedSharedList();
      const solo = await harness.listService.create({
        name: 'Just me',
        ownerId: OWNER.id,
      });
      const sharedItem = await addMovie(harness, shared.id, 1);
      const soloItem = await addMovie(harness, solo.id, 1);

      const found = await harness.itemService.itemsContaining(
        OWNER.id,
        1,
        MediaType.MOVIE
      );

      assert.deepStrictEqual(
        new Set(found.map((match) => `${match.listId}:${match.itemId}`)),
        new Set([`${shared.id}:${sharedItem.id}`, `${solo.id}:${soloItem.id}`])
      );
      // The reader shares the same list, so they see it too.
      assert.deepStrictEqual(
        await harness.itemService.itemsContaining(
          READER.id,
          1,
          MediaType.MOVIE
        ),
        [{ listId: shared.id, itemId: sharedItem.id }]
      );
    });

    it('never reports a list the caller cannot see', async () => {
      const harness = buildHarness();
      const shared = await harness.seedSharedList();
      await addMovie(harness, shared.id, 1);

      const found = await harness.itemService.itemsContaining(
        STRANGER.id,
        1,
        MediaType.MOVIE
      );

      assert.deepStrictEqual(found, []);
    });

    it('treats a movie and a series with the same tmdb id as different titles', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovie(harness, list.id, 1);

      const found = await harness.itemService.itemsContaining(
        OWNER.id,
        1,
        MediaType.TV
      );

      assert.deepStrictEqual(found, []);
    });
  });
});
