import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import { MediaListAccessDeniedError } from '@server/features/mediaLists/domain/errors/MediaListErrors';
import { MediaListAccessPolicy } from '@server/features/mediaLists/domain/services/MediaListAccessPolicy';
import { user } from '@server/features/mediaLists/domain/test/fakes';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type {
  MediaListAction,
  MediaListMembership,
} from '@server/features/mediaLists/domain/valueObjects/MediaListMembership';
import assert from 'node:assert';
import { describe, it } from 'node:test';

const policy = new MediaListAccessPolicy();

const owner: MediaListMembership = { kind: 'owner' };
const writer: MediaListMembership = {
  kind: 'collaborator',
  role: CollaboratorRole.WRITE,
};
const reader: MediaListMembership = {
  kind: 'collaborator',
  role: CollaboratorRole.READ,
};
const stranger: MediaListMembership = { kind: 'none' };

// One row per action, listing exactly who may perform it.
const matrix: {
  action: MediaListAction;
  allowed: MediaListMembership[];
}[] = [
  { action: 'viewList', allowed: [owner, writer, reader] },
  { action: 'trackOwnProgress', allowed: [owner, writer, reader] },
  { action: 'editListItems', allowed: [owner, writer] },
  { action: 'editListDetails', allowed: [owner, writer] },
  { action: 'deleteList', allowed: [owner] },
  { action: 'manageCollaborators', allowed: [owner] },
  { action: 'leaveList', allowed: [writer, reader] },
];

const label = (membership: MediaListMembership) =>
  membership.kind === 'collaborator'
    ? `${membership.kind}:${membership.role}`
    : membership.kind;

describe('MediaListAccessPolicy', () => {
  describe('permission matrix', () => {
    const everyone = [owner, writer, reader, stranger];

    for (const { action, allowed } of matrix) {
      for (const membership of everyone) {
        const shouldAllow = allowed.includes(membership);
        it(`${shouldAllow ? 'allows' : 'denies'} ${label(
          membership
        )} to ${action}`, () => {
          assert.strictEqual(policy.can(membership, action), shouldAllow);
        });
      }
    }
  });

  it('denies a stranger every action', () => {
    for (const { action } of matrix) {
      assert.strictEqual(policy.can(stranger, action), false);
    }
  });

  it('never lets a write collaborator delete or share the list', () => {
    assert.strictEqual(policy.can(writer, 'deleteList'), false);
    assert.strictEqual(policy.can(writer, 'manageCollaborators'), false);
  });

  it('lets a read-only collaborator track their own progress but not edit items', () => {
    assert.strictEqual(policy.can(reader, 'trackOwnProgress'), true);
    assert.strictEqual(policy.can(reader, 'editListItems'), false);
  });

  it('throws MediaListAccessDeniedError when asserting a denied action', () => {
    assert.throws(
      () => policy.assertCan(reader, 'deleteList'),
      MediaListAccessDeniedError
    );
    assert.doesNotThrow(() => policy.assertCan(reader, 'viewList'));
  });

  describe('resolveMembership', () => {
    const list = { id: 1, owner: user(10) } as MediaList;

    it('treats the list owner as owner even if a role row somehow exists', () => {
      assert.deepStrictEqual(
        policy.resolveMembership(list, 10, CollaboratorRole.READ),
        { kind: 'owner' }
      );
    });

    it('uses the collaborator role when the user is not the owner', () => {
      assert.deepStrictEqual(
        policy.resolveMembership(list, 20, CollaboratorRole.WRITE),
        { kind: 'collaborator', role: CollaboratorRole.WRITE }
      );
    });

    it('returns no membership for an unrelated user', () => {
      assert.deepStrictEqual(policy.resolveMembership(list, 30, null), {
        kind: 'none',
      });
    });
  });
});
