import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import { TypeOrmMediaListCollaboratorRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListCollaboratorRepository';
import { TypeOrmMediaListItemRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListItemRepository';
import { TypeOrmMediaListRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListRepository';
import { TypeOrmMediaListWatchRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListWatchRepository';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert';
import { describe, it } from 'node:test';

const lists = new TypeOrmMediaListRepository();
const items = new TypeOrmMediaListItemRepository();
const watches = new TypeOrmMediaListWatchRepository();
const collaborators = new TypeOrmMediaListCollaboratorRepository();

const getUsers = async () => {
  const userRepository = getRepository(User);
  const owner = await userRepository.findOneOrFail({
    where: { email: 'admin@seerr.dev' },
  });
  const friend = await userRepository.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });
  return { owner, friend };
};

const seedList = async () => {
  const { owner, friend } = await getUsers();
  const list = await lists.create({
    name: 'Sunday Night Sci-Fi',
    description: 'Slow burn',
    ownerId: owner.id,
  });
  return { list, owner, friend };
};

describe('media list repositories', () => {
  setupTestDb();

  describe('TypeOrmMediaListRepository', () => {
    it('creates and reads back a list', async () => {
      const { list, owner } = await seedList();

      const found = await lists.findById(list.id);

      assert.strictEqual(found?.name, 'Sunday Night Sci-Fi');
      assert.strictEqual(found?.description, 'Slow burn');
      assert.strictEqual(found?.owner.id, owner.id);
    });

    it('returns null for a list that does not exist', async () => {
      assert.strictEqual(await lists.findById(9999), null);
    });

    // The owner relation must be hydrated, otherwise the mapper cannot build a UserRef
    // and every access check would fall over.
    it('always hydrates the owner', async () => {
      const { list } = await seedList();

      const [fromIndex] = await lists.findAccessibleTo(list.owner.id);

      assert.ok(fromIndex.owner.displayName);
      assert.ok(fromIndex.owner.avatar);
    });

    it('returns owned and shared lists together, and hides the rest', async () => {
      const { list, owner, friend } = await seedList();
      const friendsOwn = await lists.create({
        name: 'Friend list',
        description: null,
        ownerId: friend.id,
      });
      await collaborators.add({
        listId: list.id,
        userId: friend.id,
        role: CollaboratorRole.READ,
        invitedById: owner.id,
      });

      const forFriend = await lists.findAccessibleTo(friend.id);
      const forOwner = await lists.findAccessibleTo(owner.id);

      assert.deepStrictEqual(forFriend.map((entry) => entry.name).sort(), [
        'Friend list',
        'Sunday Night Sci-Fi',
      ]);
      // The owner never got access to the friend's own list.
      assert.deepStrictEqual(
        forOwner.map((entry) => entry.id),
        [list.id]
      );
      assert.ok(friendsOwn.id);
    });

    it('does not return a list twice when the user owns it', async () => {
      const { list, owner } = await seedList();

      const accessible = await lists.findAccessibleTo(owner.id);

      assert.deepStrictEqual(
        accessible.map((entry) => entry.id),
        [list.id]
      );
    });

    it('updates name and description independently', async () => {
      const { list } = await seedList();

      await lists.update(list.id, { name: 'Renamed' });
      const afterName = await lists.findById(list.id);
      assert.strictEqual(afterName?.name, 'Renamed');
      assert.strictEqual(afterName?.description, 'Slow burn');

      await lists.update(list.id, { description: null });
      const afterDescription = await lists.findById(list.id);
      assert.strictEqual(afterDescription?.name, 'Renamed');
      assert.strictEqual(afterDescription?.description, null);
    });

    it('deletes a list', async () => {
      const { list } = await seedList();

      await lists.delete(list.id);

      assert.strictEqual(await lists.findById(list.id), null);
    });

    // The requirement is a soft delete, not a hard one: the row must survive with
    // deletedAt stamped so it can still be audited or restored later.
    it('soft deletes: the row survives with deletedAt stamped', async () => {
      const { list } = await seedList();

      await lists.delete(list.id);

      const record = await getRepository(MediaListRecord).findOne({
        where: { id: list.id },
        withDeleted: true,
      });
      assert.ok(record);
      assert.ok(record?.deletedAt);
    });
  });

  describe('TypeOrmMediaListItemRepository', () => {
    it('appends items and hands out increasing positions', async () => {
      const { list, owner } = await seedList();

      const first = await items.add({
        listId: list.id,
        tmdbId: 1,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });
      const second = await items.add({
        listId: list.id,
        tmdbId: 2,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });

      assert.strictEqual(first.position, 0);
      assert.strictEqual(second.position, 1);
      assert.strictEqual(first.listId, list.id);
      assert.strictEqual(first.addedBy?.id, owner.id);
    });

    // Media is shared with requests and issues, so adding a title that already exists
    // must attach to that row instead of creating a second one.
    it('reuses an existing media row', async () => {
      const { list, owner } = await seedList();
      const existing = await getRepository(Media).save(
        new Media({ tmdbId: 693134, mediaType: MediaType.MOVIE })
      );

      await items.add({
        listId: list.id,
        tmdbId: 693134,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });

      const all = await getRepository(Media).find({
        where: { tmdbId: 693134 },
      });
      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].id, existing.id);
    });

    it('creates the media row when the title is new', async () => {
      const { list, owner } = await seedList();

      await items.add({
        listId: list.id,
        tmdbId: 999,
        mediaType: MediaType.TV,
        addedById: owner.id,
      });

      const media = await getRepository(Media).findOne({
        where: { tmdbId: 999, mediaType: MediaType.TV },
      });
      assert.ok(media);
    });

    it('finds an item by title within a list', async () => {
      const { list, owner } = await seedList();
      await items.add({
        listId: list.id,
        tmdbId: 5,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });

      assert.ok(await items.findInList(list.id, 5, MediaType.MOVIE));
      // A series with the same id is a different title.
      assert.strictEqual(
        await items.findInList(list.id, 5, MediaType.TV),
        null
      );
    });

    it('returns items ordered by position', async () => {
      const { list, owner } = await seedList();
      const first = await items.add({
        listId: list.id,
        tmdbId: 1,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });
      const second = await items.add({
        listId: list.id,
        tmdbId: 2,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });
      const third = await items.add({
        listId: list.id,
        tmdbId: 3,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });

      await items.applyOrder(list.id, [third.id, first.id, second.id]);

      const ordered = await items.findByList(list.id);
      assert.deepStrictEqual(
        ordered.map((item) => item.tmdbId),
        [3, 1, 2]
      );
      assert.deepStrictEqual(
        ordered.map((item) => item.position),
        [0, 1, 2]
      );
    });

    it('will not reorder an item belonging to a different list', async () => {
      const { list, owner } = await seedList();
      const other = await lists.create({
        name: 'Other',
        description: null,
        ownerId: owner.id,
      });
      const mine = await items.add({
        listId: list.id,
        tmdbId: 1,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });
      const theirs = await items.add({
        listId: other.id,
        tmdbId: 2,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });

      await items.applyOrder(list.id, [theirs.id, mine.id]);

      const untouched = await items.findById(theirs.id);
      assert.strictEqual(untouched?.position, 0);
    });

    it('removes an item', async () => {
      const { list, owner } = await seedList();
      const item = await items.add({
        listId: list.id,
        tmdbId: 1,
        mediaType: MediaType.MOVIE,
        addedById: owner.id,
      });

      await items.remove(item.id);

      assert.strictEqual(await items.findById(item.id), null);
    });
  });

  describe('TypeOrmMediaListWatchRepository', () => {
    const seedItem = async () => {
      const { list, owner, friend } = await seedList();
      const item = await items.add({
        listId: list.id,
        tmdbId: 1,
        mediaType: MediaType.TV,
        addedById: owner.id,
      });
      return { item, owner, friend };
    };

    it('marks and clears a movie for one user only', async () => {
      const { item, owner, friend } = await seedItem();

      await watches.setMovieWatched(item.id, owner.id);

      assert.strictEqual(await watches.isMovieWatched(item.id, owner.id), true);
      assert.strictEqual(
        await watches.isMovieWatched(item.id, friend.id),
        false
      );

      await watches.clearMovieWatched(item.id, owner.id);
      assert.strictEqual(
        await watches.isMovieWatched(item.id, owner.id),
        false
      );
    });

    // The unique constraint would reject a second row, so marking twice has to be a
    // no-op rather than an error the route would have to swallow.
    it('is idempotent when marking a movie twice', async () => {
      const { item, owner } = await seedItem();

      await watches.setMovieWatched(item.id, owner.id);
      await watches.setMovieWatched(item.id, owner.id);

      assert.strictEqual(await watches.isMovieWatched(item.id, owner.id), true);
    });

    it('records episodes per user', async () => {
      const { item, owner, friend } = await seedItem();

      await watches.setEpisodesWatched(item.id, owner.id, [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 1, episodeNumber: 2 },
      ]);
      await watches.setEpisodesWatched(item.id, friend.id, [
        { seasonNumber: 1, episodeNumber: 1 },
      ]);

      assert.strictEqual(
        (await watches.findWatchedEpisodes(item.id, owner.id)).length,
        2
      );
      assert.strictEqual(
        (await watches.findWatchedEpisodes(item.id, friend.id)).length,
        1
      );
    });

    it('skips episodes that are already recorded', async () => {
      const { item, owner } = await seedItem();

      await watches.setEpisodesWatched(item.id, owner.id, [
        { seasonNumber: 1, episodeNumber: 1 },
      ]);
      await watches.setEpisodesWatched(item.id, owner.id, [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 1, episodeNumber: 2 },
      ]);

      const watched = await watches.findWatchedEpisodes(item.id, owner.id);
      assert.strictEqual(watched.length, 2);
    });

    it('clears only the episodes it is given', async () => {
      const { item, owner } = await seedItem();
      await watches.setEpisodesWatched(item.id, owner.id, [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 1, episodeNumber: 2 },
        { seasonNumber: 2, episodeNumber: 1 },
      ]);

      await watches.clearEpisodesWatched(item.id, owner.id, [
        { seasonNumber: 1, episodeNumber: 1 },
      ]);

      const remaining = await watches.findWatchedEpisodes(item.id, owner.id);
      assert.deepStrictEqual(remaining, [
        { seasonNumber: 1, episodeNumber: 2 },
        { seasonNumber: 2, episodeNumber: 1 },
      ]);
    });

    it('clears a whole season for one user only', async () => {
      const { item, owner, friend } = await seedItem();
      await watches.setEpisodesWatched(item.id, owner.id, [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 2, episodeNumber: 1 },
      ]);
      await watches.setEpisodesWatched(item.id, friend.id, [
        { seasonNumber: 1, episodeNumber: 1 },
      ]);

      await watches.clearSeasonWatched(item.id, owner.id, 1);

      assert.deepStrictEqual(
        await watches.findWatchedEpisodes(item.id, owner.id),
        [{ seasonNumber: 2, episodeNumber: 1 }]
      );
      assert.strictEqual(
        (await watches.findWatchedEpisodes(item.id, friend.id)).length,
        1
      );
    });

    // Batched so a list view costs a fixed number of queries. The raw aliases these use
    // are the part most likely to behave differently between sqlite and postgres.
    it('reports movie and episode watches for a batch of items', async () => {
      const { item, owner, friend } = await seedItem();
      await watches.setMovieWatched(item.id, owner.id);
      await watches.setEpisodesWatched(item.id, friend.id, [
        { seasonNumber: 1, episodeNumber: 1 },
      ]);

      assert.deepStrictEqual(
        await watches.findMovieWatchesForItems([item.id]),
        [{ itemId: item.id, userId: owner.id }]
      );
      assert.deepStrictEqual(
        await watches.findEpisodeWatchesForItems([item.id]),
        [
          {
            itemId: item.id,
            userId: friend.id,
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ]
      );
    });

    it('returns nothing for an empty batch', async () => {
      assert.deepStrictEqual(await watches.findMovieWatchesForItems([]), []);
      assert.deepStrictEqual(await watches.findEpisodeWatchesForItems([]), []);
    });
  });

  describe('TypeOrmMediaListCollaboratorRepository', () => {
    it('adds a collaborator and reads the role back', async () => {
      const { list, owner, friend } = await seedList();

      const added = await collaborators.add({
        listId: list.id,
        userId: friend.id,
        role: CollaboratorRole.WRITE,
        invitedById: owner.id,
      });

      assert.strictEqual(added.user.id, friend.id);
      assert.strictEqual(added.invitedBy?.id, owner.id);
      assert.strictEqual(
        await collaborators.findRole(list.id, friend.id),
        CollaboratorRole.WRITE
      );
    });

    it('returns null for someone with no access', async () => {
      const { list, friend } = await seedList();

      assert.strictEqual(
        await collaborators.findRole(list.id, friend.id),
        null
      );
    });

    it('changes a role', async () => {
      const { list, owner, friend } = await seedList();
      await collaborators.add({
        listId: list.id,
        userId: friend.id,
        role: CollaboratorRole.READ,
        invitedById: owner.id,
      });

      const updated = await collaborators.updateRole(
        list.id,
        friend.id,
        CollaboratorRole.WRITE
      );

      assert.strictEqual(updated.role, CollaboratorRole.WRITE);
      assert.strictEqual(
        await collaborators.findRole(list.id, friend.id),
        CollaboratorRole.WRITE
      );
    });

    it('lists collaborators with their inviter', async () => {
      const { list, owner, friend } = await seedList();
      await collaborators.add({
        listId: list.id,
        userId: friend.id,
        role: CollaboratorRole.READ,
        invitedById: owner.id,
      });

      const all = await collaborators.findByList(list.id);

      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].user.id, friend.id);
      assert.strictEqual(all[0].invitedBy?.id, owner.id);
    });

    it('removes a collaborator', async () => {
      const { list, owner, friend } = await seedList();
      await collaborators.add({
        listId: list.id,
        userId: friend.id,
        role: CollaboratorRole.READ,
        invitedById: owner.id,
      });

      await collaborators.remove(list.id, friend.id);

      assert.strictEqual(
        await collaborators.findRole(list.id, friend.id),
        null
      );
      assert.deepStrictEqual(await collaborators.findByList(list.id), []);
    });
  });
});
