import {
  MediaListAccessDeniedError,
  MediaListNotFoundError,
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

describe('MediaListService', () => {
  it('creates a list owned by the caller', async () => {
    const { listService } = buildHarness();

    const list = await listService.create({
      name: 'Film club',
      ownerId: OWNER.id,
    });

    assert.strictEqual(list.name, 'Film club');
    assert.strictEqual(list.owner.id, OWNER.id);
    assert.strictEqual(list.description, null);
  });

  it('trims the name and turns a blank description into null', async () => {
    const { listService } = buildHarness();

    const list = await listService.create({
      name: '  Halloween 2026  ',
      description: '   ',
      ownerId: OWNER.id,
    });

    assert.strictEqual(list.name, 'Halloween 2026');
    assert.strictEqual(list.description, null);
  });

  it('returns the lists a user can reach', async () => {
    const { listService, seedSharedList } = buildHarness();
    await seedSharedList();
    await listService.create({ name: 'Just me', ownerId: OWNER.id });

    const mine = await listService.listsFor(OWNER.id);
    const theirs = await listService.listsFor(STRANGER.id);

    assert.deepStrictEqual(mine.map((list) => list.name).sort(), [
      'Just me',
      'Sunday Night Sci-Fi',
    ]);
    assert.deepStrictEqual(theirs, []);
  });

  it('raises not found for a list that does not exist', async () => {
    const { listService } = buildHarness();

    await assert.rejects(
      () => listService.view(999, OWNER.id),
      MediaListNotFoundError
    );
  });

  it('lets the owner and both collaborator roles view the list', async () => {
    const { listService, seedSharedList } = buildHarness();
    const list = await seedSharedList();

    for (const viewer of [OWNER, WRITER, READER]) {
      const seen = await listService.view(list.id, viewer.id);
      assert.strictEqual(seen.id, list.id);
    }
  });

  it('hides the list from someone it was never shared with', async () => {
    const { listService, seedSharedList } = buildHarness();
    const list = await seedSharedList();

    await assert.rejects(
      () => listService.view(list.id, STRANGER.id),
      MediaListAccessDeniedError
    );
  });

  describe('update', () => {
    it('allows the owner and a write collaborator', async () => {
      const { listService, seedSharedList } = buildHarness();
      const list = await seedSharedList();

      await listService.update(list.id, OWNER.id, { name: 'Renamed by owner' });
      const updated = await listService.update(list.id, WRITER.id, {
        name: 'Renamed by writer',
      });

      assert.strictEqual(updated.name, 'Renamed by writer');
    });

    it('refuses a read-only collaborator', async () => {
      const { listService, seedSharedList } = buildHarness();
      const list = await seedSharedList();

      await assert.rejects(
        () => listService.update(list.id, READER.id, { name: 'Nope' }),
        MediaListAccessDeniedError
      );
    });
  });

  describe('delete', () => {
    it('is reserved to the owner', async () => {
      const { listService, lists, seedSharedList } = buildHarness();
      const list = await seedSharedList();

      await listService.delete(list.id, OWNER.id);

      assert.strictEqual(lists.lists.length, 0);
    });

    // The requirement is explicit that only the author can delete, so a write
    // collaborator having every other editing right must still be refused here.
    it('refuses a write collaborator', async () => {
      const { listService, lists, seedSharedList } = buildHarness();
      const list = await seedSharedList();

      await assert.rejects(
        () => listService.delete(list.id, WRITER.id),
        MediaListAccessDeniedError
      );
      assert.strictEqual(lists.lists.length, 1);
    });
  });
});
