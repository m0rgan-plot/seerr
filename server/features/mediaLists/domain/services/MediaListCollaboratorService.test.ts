import {
  CannotCollaborateAsOwnerError,
  CollaboratorNotFoundError,
  DuplicateCollaboratorError,
  InviteNotFoundError,
  MediaListAccessDeniedError,
  UserNotFoundError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import {
  OWNER,
  READER,
  STRANGER,
  WRITER,
  buildHarness,
} from '@server/features/mediaLists/domain/test/harness';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import { InviteStatus } from '@server/features/mediaLists/domain/valueObjects/InviteStatus';
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
      recipientId: WRITER.id,
      role: CollaboratorRole.WRITE,
      actor: OWNER,
    });

    assert.strictEqual(collaborator.user.id, WRITER.id);
    assert.strictEqual(collaborator.role, CollaboratorRole.WRITE);
    assert.strictEqual(collaborator.status, InviteStatus.PENDING);
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
          recipientId: OWNER.id,
          role: CollaboratorRole.WRITE,
          actor: OWNER,
        }),
      CannotCollaborateAsOwnerError
    );
  });

  // Permission is checked before the recipient is resolved, so a caller who is not the
  // owner cannot tell a real user id from an invented one.
  it('refuses a non-owner before it ever looks the recipient up', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    await assert.rejects(
      () =>
        harness.collaboratorService.share({
          listId: list.id,
          recipientId: 123456,
          role: CollaboratorRole.READ,
          actor: WRITER,
        }),
      MediaListAccessDeniedError
    );
  });

  it('reports an unknown recipient to the owner', async () => {
    const harness = buildHarness();
    const list = await harness.listService.create({
      name: 'Film club',
      ownerId: OWNER.id,
    });

    await assert.rejects(
      () =>
        harness.collaboratorService.share({
          listId: list.id,
          recipientId: 123456,
          role: CollaboratorRole.READ,
          actor: OWNER,
        }),
      UserNotFoundError
    );
  });

  it('refuses to share with someone who already has access', async () => {
    const harness = buildHarness();
    const list = await harness.seedSharedList();

    await assert.rejects(
      () =>
        harness.collaboratorService.share({
          listId: list.id,
          recipientId: READER.id,
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
            recipientId: STRANGER.id,
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

  describe('acceptInvite', () => {
    it('grants access and flips the row to accepted', async () => {
      const harness = buildHarness();
      const list = await harness.listService.create({
        name: 'Film club',
        ownerId: OWNER.id,
      });
      await harness.collaboratorService.share({
        listId: list.id,
        recipientId: WRITER.id,
        role: CollaboratorRole.READ,
        actor: OWNER,
      });

      const accepted = await harness.collaboratorService.acceptInvite({
        listId: list.id,
        userId: WRITER.id,
      });

      assert.strictEqual(accepted.status, InviteStatus.ACCEPTED);
      assert.strictEqual(
        await harness.collaborators.findAcceptedRole(list.id, WRITER.id),
        CollaboratorRole.READ
      );
    });

    it('raises when there is no pending invite for that user', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () =>
          harness.collaboratorService.acceptInvite({
            listId: list.id,
            userId: STRANGER.id,
          }),
        InviteNotFoundError
      );
    });

    it('raises for an invite that was already accepted', async () => {
      const harness = buildHarness();
      // WRITER is seeded already-accepted, so this is a second attempt.
      const list = await harness.seedSharedList();

      await assert.rejects(
        () =>
          harness.collaboratorService.acceptInvite({
            listId: list.id,
            userId: WRITER.id,
          }),
        InviteNotFoundError
      );
    });
  });

  describe('rejectInvite', () => {
    it('deletes the row and leaves no access behind', async () => {
      const harness = buildHarness();
      const list = await harness.listService.create({
        name: 'Film club',
        ownerId: OWNER.id,
      });
      await harness.collaboratorService.share({
        listId: list.id,
        recipientId: WRITER.id,
        role: CollaboratorRole.READ,
        actor: OWNER,
      });

      await harness.collaboratorService.rejectInvite({
        listId: list.id,
        userId: WRITER.id,
      });

      assert.strictEqual(
        await harness.collaborators.findRole(list.id, WRITER.id),
        null
      );
    });

    // Final: no un-reject. The owner sends a fresh invite instead, which must not
    // collide with the deleted row.
    it('lets the owner invite the same person again after a reject', async () => {
      const harness = buildHarness();
      const list = await harness.listService.create({
        name: 'Film club',
        ownerId: OWNER.id,
      });
      await harness.collaboratorService.share({
        listId: list.id,
        recipientId: WRITER.id,
        role: CollaboratorRole.READ,
        actor: OWNER,
      });
      await harness.collaboratorService.rejectInvite({
        listId: list.id,
        userId: WRITER.id,
      });

      const reinvited = await harness.collaboratorService.share({
        listId: list.id,
        recipientId: WRITER.id,
        role: CollaboratorRole.WRITE,
        actor: OWNER,
      });

      assert.strictEqual(reinvited.status, InviteStatus.PENDING);
      assert.strictEqual(reinvited.role, CollaboratorRole.WRITE);
    });

    it('raises when there is no pending invite for that user', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () =>
          harness.collaboratorService.rejectInvite({
            listId: list.id,
            userId: STRANGER.id,
          }),
        InviteNotFoundError
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
