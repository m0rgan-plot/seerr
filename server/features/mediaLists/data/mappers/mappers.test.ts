import { MediaType } from '@server/constants/media';
import { User } from '@server/entity/User';
import {
  toCollaborator,
  toCollaboratorRole,
} from '@server/features/mediaLists/data/mappers/collaboratorMapper';
import { toMediaListItem } from '@server/features/mediaLists/data/mappers/mediaListItemMapper';
import { toMediaList } from '@server/features/mediaLists/data/mappers/mediaListMapper';
import { toUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import MediaListCollaboratorRecord from '@server/features/mediaLists/data/orm/MediaListCollaboratorRecord';
import MediaListItemRecord from '@server/features/mediaLists/data/orm/MediaListItemRecord';
import MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import assert from 'node:assert';
import { describe, it } from 'node:test';

const buildUser = (overrides: Partial<User> = {}) =>
  Object.assign(new User(), {
    id: 7,
    email: 'someone@seerr.dev',
    username: 'someone',
    avatar: 'https://example.test/avatar.png',
    ...overrides,
  });

describe('media list mappers', () => {
  describe('toUserRef', () => {
    // The point of the mapper: a domain object cannot carry a token or a password hash
    // even if the entity it came from did.
    it('drops every sensitive field', () => {
      const user = buildUser({
        plexToken: 'super-secret',
        password: 'hashed',
        email: 'private@seerr.dev',
      });

      const ref = toUserRef(user);

      assert.deepStrictEqual(Object.keys(ref).sort(), [
        'avatar',
        'displayName',
        'id',
      ]);
      assert.strictEqual(JSON.stringify(ref).includes('super-secret'), false);
      assert.strictEqual(JSON.stringify(ref).includes('hashed'), false);
    });

    it('prefers the display name the entity computed', () => {
      const user = buildUser();
      user.displayName = 'Computed Name';

      assert.strictEqual(toUserRef(user).displayName, 'Computed Name');
    });

    it('falls back through username, plex and email', () => {
      assert.strictEqual(toUserRef(buildUser()).displayName, 'someone');
      assert.strictEqual(
        toUserRef(buildUser({ username: undefined, plexUsername: 'plexname' }))
          .displayName,
        'plexname'
      );
      assert.strictEqual(
        toUserRef(
          buildUser({
            username: undefined,
            plexUsername: null,
            jellyfinUsername: null,
          })
        ).displayName,
        'someone@seerr.dev'
      );
    });
  });

  describe('toMediaList', () => {
    it('maps a record to the domain shape', () => {
      const created = new Date('2026-08-01T10:00:00Z');
      const record = new MediaListRecord({
        id: 3,
        name: 'Sunday Night Sci-Fi',
        description: 'Slow burn',
        owner: buildUser(),
        createdAt: created,
        updatedAt: created,
      });

      const list = toMediaList(record);

      assert.strictEqual(list.id, 3);
      assert.strictEqual(list.name, 'Sunday Night Sci-Fi');
      assert.strictEqual(list.description, 'Slow burn');
      assert.strictEqual(list.owner.id, 7);
      assert.strictEqual(list.createdAt, created);
    });

    it('normalises a missing description to null', () => {
      const record = new MediaListRecord({
        id: 1,
        name: 'No description',
        owner: buildUser(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      assert.strictEqual(toMediaList(record).description, null);
    });
  });

  describe('toMediaListItem', () => {
    it('maps a record and takes the list id from the caller', () => {
      const record = new MediaListItemRecord({
        id: 11,
        tmdbId: 693134,
        mediaType: MediaType.MOVIE,
        position: 2,
        addedBy: buildUser(),
        createdAt: new Date(),
      });

      const item = toMediaListItem(record, 42);

      assert.strictEqual(item.id, 11);
      assert.strictEqual(item.listId, 42);
      assert.strictEqual(item.tmdbId, 693134);
      assert.strictEqual(item.mediaType, MediaType.MOVIE);
      assert.strictEqual(item.position, 2);
      assert.strictEqual(item.addedBy?.id, 7);
    });

    it('keeps an item whose author was deleted', () => {
      const record = new MediaListItemRecord({
        id: 12,
        tmdbId: 1,
        mediaType: MediaType.TV,
        position: 0,
        addedBy: null,
        createdAt: new Date(),
      });

      assert.strictEqual(toMediaListItem(record, 1).addedBy, null);
    });

    it('defaults pinnedAt to null and passes through a pinned timestamp', () => {
      const unpinned = new MediaListItemRecord({
        id: 13,
        tmdbId: 1,
        mediaType: MediaType.MOVIE,
        position: 0,
        createdAt: new Date(),
      });
      assert.strictEqual(toMediaListItem(unpinned, 1).pinnedAt, null);

      const pinnedAt = new Date('2026-08-24T10:00:00.000Z');
      const pinned = new MediaListItemRecord({
        id: 14,
        tmdbId: 2,
        mediaType: MediaType.MOVIE,
        position: 0,
        pinnedAt,
        createdAt: new Date(),
      });
      assert.strictEqual(
        toMediaListItem(pinned, 1).pinnedAt?.getTime(),
        pinnedAt.getTime()
      );
    });
  });

  describe('toCollaboratorRole', () => {
    it('maps the known roles', () => {
      assert.strictEqual(toCollaboratorRole('read'), CollaboratorRole.READ);
      assert.strictEqual(toCollaboratorRole('write'), CollaboratorRole.WRITE);
    });

    // Failing closed matters here: an unrecognised value must not be treated as write.
    it('falls back to read for anything unrecognised', () => {
      assert.strictEqual(toCollaboratorRole('admin'), CollaboratorRole.READ);
      assert.strictEqual(toCollaboratorRole(''), CollaboratorRole.READ);
    });
  });

  describe('toCollaborator', () => {
    it('maps a record to the domain shape', () => {
      const record = new MediaListCollaboratorRecord({
        id: 5,
        user: buildUser({ id: 8, username: 'friend' }),
        role: 'write',
        invitedBy: buildUser(),
        createdAt: new Date(),
      });

      const collaborator = toCollaborator(record);

      assert.strictEqual(collaborator.user.id, 8);
      assert.strictEqual(collaborator.role, CollaboratorRole.WRITE);
      assert.strictEqual(collaborator.invitedBy?.id, 7);
    });

    it('handles an inviter who has since been deleted', () => {
      const record = new MediaListCollaboratorRecord({
        id: 6,
        user: buildUser(),
        role: 'read',
        invitedBy: null,
        createdAt: new Date(),
      });

      assert.strictEqual(toCollaborator(record).invitedBy, null);
    });
  });
});
