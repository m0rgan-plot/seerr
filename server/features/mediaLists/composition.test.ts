import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import {
  buildMediaListServices,
  getMediaListServices,
} from '@server/features/mediaLists/composition';
import { toUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import {
  DuplicateMediaListItemError,
  MediaListAccessDeniedError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import notificationManager from '@server/lib/notifications';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

const getUsers = async () => {
  const userRepository = getRepository(User);
  const owner = await userRepository.findOneOrFail({
    where: { email: 'admin@seerr.dev' },
  });
  const friend = await userRepository.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });
  return { owner: toUserRef(owner), friend: toUserRef(friend) };
};

// Exercises the real services against the real adapters and the real schema. The unit
// tests prove the rules and the repository tests prove the queries; this proves the two
// halves were wired to each other correctly.
describe('media list composition', () => {
  setupTestDb();

  beforeEach(() => {
    mock.restoreAll();
  });

  it('runs a full collaborative flow end to end', async () => {
    const sent = mock.method(
      notificationManager,
      'sendNotification',
      () => undefined
    );
    const services = buildMediaListServices();
    const { owner, friend } = await getUsers();

    const list = await services.lists.create({
      name: 'Sunday Night Sci-Fi',
      description: '  Slow burn  ',
      ownerId: owner.id,
    });
    assert.strictEqual(list.description, 'Slow burn');

    // A stranger cannot see it yet.
    await assert.rejects(
      () => services.lists.view(list.id, friend.id),
      MediaListAccessDeniedError
    );

    await services.collaborators.share({
      listId: list.id,
      recipientId: friend.id,
      role: CollaboratorRole.WRITE,
      actor: owner,
    });

    // Sharing notifies the recipient.
    assert.strictEqual(sent.mock.callCount(), 1);

    const shared = await services.lists.view(list.id, friend.id);
    assert.strictEqual(shared.id, list.id);

    // The collaborator adds a title, which notifies the owner.
    const item = await services.items.add({
      listId: list.id,
      tmdbId: 693134,
      mediaType: MediaType.MOVIE,
      actor: friend,
    });
    assert.strictEqual(item.addedBy?.id, friend.id);
    assert.strictEqual(sent.mock.callCount(), 2);

    await assert.rejects(
      () =>
        services.items.add({
          listId: list.id,
          tmdbId: 693134,
          mediaType: MediaType.MOVIE,
          actor: friend,
        }),
      DuplicateMediaListItemError
    );

    // Watched state is personal to whoever recorded it.
    await services.watches.setMovieWatched(list.id, item.id, friend.id, true);
    const ownerItems = await services.items.itemsOf(list.id, owner.id);
    assert.strictEqual(ownerItems.length, 1);

    // Revoking access takes effect on the next action.
    await services.collaborators.remove({
      listId: list.id,
      userId: friend.id,
      actorId: owner.id,
    });
    await assert.rejects(
      () => services.items.itemsOf(list.id, friend.id),
      MediaListAccessDeniedError
    );

    // Only the owner can delete, and deleting takes the items with it.
    await services.lists.delete(list.id, owner.id);
    assert.deepStrictEqual(await services.lists.listsFor(owner.id), []);
  });

  // Routes reach for the memoized accessor rather than rebuilding the graph per request.
  it('reuses the same service graph across calls', () => {
    const first = getMediaListServices();
    const second = getMediaListServices();

    assert.strictEqual(first, second);
    assert.notStrictEqual(first, buildMediaListServices());
  });

  it('derives season progress from the TMDB episode counts', async () => {
    mock.method(notificationManager, 'sendNotification', () => undefined);

    const services = buildMediaListServices({
      tv: {
        getSeasonEpisodeCounts: async () => [
          { seasonNumber: 0, episodeCount: 3 },
          { seasonNumber: 1, episodeCount: 2 },
        ],
        getSeasonEpisodeNumbers: async () => [1, 2],
      },
    });
    const { owner } = await getUsers();

    const list = await services.lists.create({
      name: 'Series',
      ownerId: owner.id,
    });
    const show = await services.items.add({
      listId: list.id,
      tmdbId: 125988,
      mediaType: MediaType.TV,
      actor: owner,
    });

    await services.watches.setEpisodeWatched(
      list.id,
      show.id,
      owner.id,
      1,
      1,
      true
    );

    const partial = await services.watches.progressFor(
      list.id,
      show.id,
      owner.id
    );
    assert.strictEqual(partial.progress.watchedEpisodes, 1);
    assert.strictEqual(partial.progress.totalEpisodes, 2);
    assert.strictEqual(partial.progress.isComplete, false);

    // Marking the season writes every episode TMDB reports for it.
    await services.watches.setSeasonWatched(
      list.id,
      show.id,
      owner.id,
      1,
      true
    );

    const complete = await services.watches.progressFor(
      list.id,
      show.id,
      owner.id
    );
    assert.strictEqual(complete.progress.watchedEpisodes, 2);
    // Specials are tracked but never block completion.
    assert.strictEqual(complete.progress.isComplete, true);
  });
});
