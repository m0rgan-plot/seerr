import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import MediaListCollaboratorRecord from '@server/features/mediaLists/data/orm/MediaListCollaboratorRecord';
import MediaListEpisodeWatchRecord from '@server/features/mediaLists/data/orm/MediaListEpisodeWatchRecord';
import MediaListItemRecord from '@server/features/mediaLists/data/orm/MediaListItemRecord';
import MediaListItemWatchRecord from '@server/features/mediaLists/data/orm/MediaListItemWatchRecord';
import MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import { setupTestDb } from '@server/test/db';
import assert from 'node:assert';
import { describe, it } from 'node:test';

const getUsers = async () => {
  const userRepository = getRepository(User);
  const owner = await userRepository.findOneOrFail({
    where: { email: 'admin@seerr.dev' },
  });
  const collaborator = await userRepository.findOneOrFail({
    where: { email: 'friend@seerr.dev' },
  });
  return { owner, collaborator };
};

const createList = async (owner: User) =>
  getRepository(MediaListRecord).save(
    new MediaListRecord({ name: 'Sunday Night Sci-Fi', owner })
  );

const createMedia = async (tmdbId: number, mediaType: MediaType) =>
  getRepository(Media).save(new Media({ tmdbId, mediaType }));

const createItem = async (
  list: MediaListRecord,
  media: Media,
  addedBy?: User
) =>
  getRepository(MediaListItemRecord).save(
    new MediaListItemRecord({
      list,
      media,
      tmdbId: media.tmdbId,
      mediaType: media.mediaType,
      position: 0,
      addedBy,
    })
  );

describe('media list persistence', () => {
  setupTestDb();

  it('persists a list against its owner', async () => {
    const { owner } = await getUsers();
    const saved = await createList(owner);

    const found = await getRepository(MediaListRecord).findOneOrFail({
      where: { id: saved.id },
      relations: { owner: true },
    });

    assert.strictEqual(found.name, 'Sunday Night Sci-Fi');
    assert.strictEqual(found.owner.id, owner.id);
  });

  it('rejects the same title twice in one list', async () => {
    const { owner } = await getUsers();
    const list = await createList(owner);
    const media = await createMedia(693134, MediaType.MOVIE);
    await createItem(list, media);

    await assert.rejects(() => createItem(list, media));
  });

  it('allows the same title in two different lists', async () => {
    const { owner } = await getUsers();
    const first = await createList(owner);
    const second = await getRepository(MediaListRecord).save(
      new MediaListRecord({ name: 'Film club', owner })
    );
    const media = await createMedia(693134, MediaType.MOVIE);

    await createItem(first, media);
    await createItem(second, media);

    assert.strictEqual(await getRepository(MediaListItemRecord).count(), 2);
  });

  it('cascades a list delete down to its items and watch state', async () => {
    const { owner } = await getUsers();
    const list = await createList(owner);
    const item = await createItem(list, await createMedia(1, MediaType.TV));
    await getRepository(MediaListEpisodeWatchRecord).save(
      new MediaListEpisodeWatchRecord({
        listItem: item,
        user: owner,
        seasonNumber: 1,
        episodeNumber: 1,
      })
    );

    await getRepository(MediaListRecord).delete(list.id);

    assert.strictEqual(await getRepository(MediaListItemRecord).count(), 0);
    assert.strictEqual(
      await getRepository(MediaListEpisodeWatchRecord).count(),
      0
    );
  });

  it('keeps movie watch state unique per user and item', async () => {
    const { owner, collaborator } = await getUsers();
    const list = await createList(owner);
    const item = await createItem(list, await createMedia(2, MediaType.MOVIE));
    const watchRepository = getRepository(MediaListItemWatchRecord);

    await watchRepository.save(
      new MediaListItemWatchRecord({ listItem: item, user: owner })
    );
    // A second user marking the same title is a separate row, not a conflict.
    await watchRepository.save(
      new MediaListItemWatchRecord({ listItem: item, user: collaborator })
    );

    assert.strictEqual(await watchRepository.count(), 2);
    await assert.rejects(() =>
      watchRepository.save(
        new MediaListItemWatchRecord({ listItem: item, user: owner })
      )
    );
  });

  it('keeps episode watch state unique per user, season and episode', async () => {
    const { owner, collaborator } = await getUsers();
    const list = await createList(owner);
    const item = await createItem(list, await createMedia(3, MediaType.TV));
    const watchRepository = getRepository(MediaListEpisodeWatchRecord);
    const episode = { listItem: item, seasonNumber: 2, episodeNumber: 4 };

    await watchRepository.save(
      new MediaListEpisodeWatchRecord({ ...episode, user: owner })
    );
    await watchRepository.save(
      new MediaListEpisodeWatchRecord({ ...episode, user: collaborator })
    );
    await watchRepository.save(
      new MediaListEpisodeWatchRecord({
        ...episode,
        episodeNumber: 5,
        user: owner,
      })
    );

    assert.strictEqual(await watchRepository.count(), 3);
    await assert.rejects(() =>
      watchRepository.save(
        new MediaListEpisodeWatchRecord({ ...episode, user: owner })
      )
    );
  });

  it('allows one collaborator row per user and list', async () => {
    const { owner, collaborator } = await getUsers();
    const list = await createList(owner);
    const collaboratorRepository = getRepository(MediaListCollaboratorRecord);

    await collaboratorRepository.save(
      new MediaListCollaboratorRecord({
        list,
        user: collaborator,
        role: 'write',
        invitedBy: owner,
      })
    );

    await assert.rejects(() =>
      collaboratorRepository.save(
        new MediaListCollaboratorRecord({
          list,
          user: collaborator,
          role: 'read',
        })
      )
    );
  });

  it('drops collaborator rows when the user is deleted', async () => {
    const { owner, collaborator } = await getUsers();
    const list = await createList(owner);
    await getRepository(MediaListCollaboratorRecord).save(
      new MediaListCollaboratorRecord({
        list,
        user: collaborator,
        role: 'read',
      })
    );

    await getRepository(User).delete(collaborator.id);

    assert.strictEqual(
      await getRepository(MediaListCollaboratorRecord).count(),
      0
    );
  });

  it('keeps an item when the user who added it is deleted', async () => {
    const { owner, collaborator } = await getUsers();
    const list = await createList(owner);
    const item = await createItem(
      list,
      await createMedia(4, MediaType.MOVIE),
      collaborator
    );

    await getRepository(User).delete(collaborator.id);

    const found = await getRepository(MediaListItemRecord).findOneOrFail({
      where: { id: item.id },
      relations: { addedBy: true },
    });
    assert.strictEqual(found.addedBy, null);
  });
});
