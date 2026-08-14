import {
  CannotCollaborateAsOwnerError,
  CollaboratorNotFoundError,
  DuplicateCollaboratorError,
  MediaListAccessDeniedError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import {
  OWNER,
  READER,
  STRANGER,
  WRITER,
  buildHarness,
} from '@server/features/mediaLists/domain/test/harness';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('MediaListCollaboratorService', () => {
  it('shares a list and notifies the recipient', async () => {
    const harness = buildHarness();
    const list = await harness.listService.create({
      name: 'Film club',
      ownerId: OWNER.id,
    });

    const collaborator = await harness.collaboratorService.share({
      listId: list.id,
      recipient: WRITER,
      role: CollaboratorRole.WRITE,
      actor: OWNER,
    });

    assert.strictEqual(collaborator.user.id, WRITER.id);
    assert.strictEqual(collaborator.role, CollaboratorRole.WRITE);
    assert.strictEqual(harness.notifications.shared.length, 1);
    assert.strictEqual(harness.notifications.shared[0].recipient.id, WRITER.id);
    assert.strictEqual(harness.notifications.shared[0].invitedBy.id, OWNER.id);
  });

  // Ownership is not a role, so letting the owner also hold a collaborator row would
  // create two sources of truth for what they can do.
  it('refuses to add the owner as a collaborator', async () => {
    const harness = buildHarness();
    const list = await harness.listService.create({
      name: 'Film club',
      ownerId: OWNER.id,
    });

    await assert.rejects(
      () =>
        harness.collaboratorService.share({
          listId: list.id,
          recipient: OWNER,
          role: CollaboratorRole.WRITE,
          actor: OWNER,
        }),
      CannotCollaborateAsOwnerError
    );
  });

  it('refuses to share with someone who already has access', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    await assert.rejects(
      () =>
        harness.collaboratorService.share({
          listId: list.id,
          recipient: READER,
          role: CollaboratorRole.WRITE,
          actor: OWNER,
        }),
      DuplicateCollaboratorError
    );
  });

  it('only lets the owner share', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    for (const actor of [WRITER, READER, STRANGER]) {
      await assert.rejects(
        () =>
          harness.collaboratorService.share({
            listId: list.id,
            recipient: STRANGER,
            role: CollaboratorRole.READ,
            actor,
          }),
        MediaListAccessDeniedError
      );
    }
    assert.strictEqual(harness.notifications.shared.length, 0);
  });

  describe('changeRole', () => {
    it('promotes a reader to write', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      const updated = await harness.collaboratorService.changeRole({
        listId: list.id,
        userId: READER.id,
        role: CollaboratorRole.WRITE,
        actorId: OWNER.id,
      });

      assert.strictEqual(updated.role, CollaboratorRole.WRITE);
    });

    it('refuses a write collaborator changing someone else', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () =>
          harness.collaboratorService.changeRole({
            listId: list.id,
            userId: READER.id,
            role: CollaboratorRole.WRITE,
            actorId: WRITER.id,
          }),
        MediaListAccessDeniedError
      );
    });

    it('raises when the user is not a collaborator', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () =>
          harness.collaboratorService.changeRole({
            listId: list.id,
            userId: STRANGER.id,
            role: CollaboratorRole.READ,
            actorId: OWNER.id,
          }),
        CollaboratorNotFoundError
      );
    });
  });

  describe('remove', () => {
    it('lets the owner remove someone', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await harness.collaboratorService.remove({
        listId: list.id,
        userId: READER.id,
        actorId: OWNER.id,
      });

      assert.strictEqual(
        await harness.collaborators.findRole(list.id, READER.id),
        null
      );
    });

    it('lets a collaborator remove themselves', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await harness.collaboratorService.remove({
        listId: list.id,
        userId: READER.id,
        actorId: READER.id,
      });

      assert.strictEqual(
        await harness.collaborators.findRole(list.id, READER.id),
        null
      );
    });

    it('refuses a collaborator removing a different collaborator', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () =>
          harness.collaboratorService.remove({
            listId: list.id,
            userId: READER.id,
            actorId: WRITER.id,
          }),
        MediaListAccessDeniedError
      );
    });

    it('refuses a stranger removing themselves from a list they are not on', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () =>
          harness.collaboratorService.remove({
            listId: list.id,
            userId: STRANGER.id,
            actorId: STRANGER.id,
          }),
        MediaListAccessDeniedError
      );
    });
  });

  it('lists collaborators for any member but not for a stranger', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    const seen = await harness.collaboratorService.listFor(list.id, READER.id);
    assert.deepStrictEqual(
      seen.map((collaborator) => collaborator.user.id).sort(),
      [WRITER.id, READER.id].sort()
    );

    await assert.rejects(
      () => harness.collaboratorService.listFor(list.id, STRANGER.id),
      MediaListAccessDeniedError
    );
  });
});
