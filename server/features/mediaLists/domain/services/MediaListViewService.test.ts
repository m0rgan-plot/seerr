import { MediaType } from '@server/constants/media';
import { MediaListAccessDeniedError } from '@server/features/mediaLists/domain/errors/MediaListErrors';
import {
  buildHarness,
  MISSING_ARTWORK_TMDB_ID,
  OWNER,
  READER,
  STRANGER,
  WRITER,
} from '@server/features/mediaLists/domain/test/harness';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import assert from 'node:assert';
import { describe, it } from 'node:test';

const addMovies = async (
  harness: ReturnType<typeof buildHarness>,
  listId: number,
  tmdbIds: number[]
) => {
  for (const tmdbId of tmdbIds) {
    await harness.itemService.add({
      listId,
      tmdbId,
      mediaType: MediaType.MOVIE,
      actor: OWNER,
    });
  }
};

describe('MediaListViewService', () => {
  describe('summaries', () => {
    it('counts titles and how many the caller has finished', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [1, 2, 3]);
      const [first] = await harness.itemService.itemsOf(list.id, OWNER.id);
      await harness.watchService.setMovieWatched(
        list.id,
        first.id,
        OWNER.id,
        true
      );

      const [forOwner] = await harness.viewService.summariesFor(OWNER.id);

      assert.strictEqual(forOwner.itemCount, 3);
      assert.strictEqual(forOwner.seenCount, 1);
      assert.deepStrictEqual(forOwner.membership, { kind: 'owner' });
    });

    // seenCount is the caller's own progress, so two members of one list see
    // different numbers for the same titles.
    it('counts each member separately', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [1, 2]);
      const items = await harness.itemService.itemsOf(list.id, OWNER.id);
      await harness.watchService.setMovieWatched(
        list.id,
        items[0].id,
        WRITER.id,
        true
      );

      const [forOwner] = await harness.viewService.summariesFor(OWNER.id);
      assert.strictEqual(forOwner.seenCount, 0);
    });

    it('resolves a poster for each preview title', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [11, 12]);
      const items = await harness.itemService.itemsOf(list.id, OWNER.id);

      const [summary] = await harness.viewService.summariesFor(OWNER.id);

      assert.deepStrictEqual(summary.previewItems, [
        {
          id: items[0].id,
          tmdbId: 11,
          mediaType: MediaType.MOVIE,
          posterPath: '/poster-11.jpg',
          watched: false,
          status: null,
        },
        {
          id: items[1].id,
          tmdbId: 12,
          mediaType: MediaType.MOVIE,
          posterPath: '/poster-12.jpg',
          watched: false,
          status: null,
        },
      ]);
    });

    it('reports the caller watched state on each preview title', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [21, 22]);
      const items = await harness.itemService.itemsOf(list.id, OWNER.id);
      await harness.watchService.setMovieWatched(
        list.id,
        items[0].id,
        OWNER.id,
        true
      );

      const [summary] = await harness.viewService.summariesFor(OWNER.id);

      assert.deepStrictEqual(
        summary.previewItems.map((item) => item.watched),
        [true, false]
      );
    });

    // Artwork is decoration: a title with no art leaves a gap rather than failing the page.
    it('leaves the poster null when there is no art', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [MISSING_ARTWORK_TMDB_ID]);

      const [summary] = await harness.viewService.summariesFor(OWNER.id);

      assert.strictEqual(summary.previewItems[0].posterPath, null);
    });

    // The strip only holds so many, and every extra preview is another TMDB lookup.
    it('caps the preview at seven titles', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const [summary] = await harness.viewService.summariesFor(OWNER.id);

      assert.strictEqual(summary.itemCount, 9);
      assert.strictEqual(summary.previewItems.length, 7);
      assert.deepStrictEqual(
        summary.previewItems.map((item) => item.tmdbId),
        [1, 2, 3, 4, 5, 6, 7]
      );
    });

    it('returns an empty preview for a list with nothing on it', async () => {
      const harness = buildHarness();
      await harness.seedSharedList();

      const [summary] = await harness.viewService.summariesFor(OWNER.id);

      assert.strictEqual(summary.itemCount, 0);
      assert.deepStrictEqual(summary.previewItems, []);
    });

    it('reports the role each member holds', async () => {
      const harness = buildHarness();
      await harness.seedSharedList();

      const [asWriter] = await harness.viewService.summariesFor(WRITER.id);
      const [asReader] = await harness.viewService.summariesFor(READER.id);

      assert.deepStrictEqual(asWriter.membership, {
        kind: 'collaborator',
        role: 'write',
      });
      assert.deepStrictEqual(asReader.membership, {
        kind: 'collaborator',
        role: 'read',
      });
    });

    it('shows nothing to someone with no lists', async () => {
      const harness = buildHarness();
      await harness.seedSharedList();

      assert.deepStrictEqual(
        await harness.viewService.summariesFor(STRANGER.id),
        []
      );
    });

    it('reports who each list is shared with', async () => {
      const harness = buildHarness();
      await harness.seedSharedList();

      const [summary] = await harness.viewService.summariesFor(OWNER.id);

      assert.deepStrictEqual(
        summary.sharedWith.map((collaborator) => collaborator.id).sort(),
        [WRITER.id, READER.id].sort()
      );
    });

    // The index summary is documented as N+1-prone (server/features/mediaLists/domain
    // read path). Collaborators must be fetched once for every visible list, not once
    // per list, or this feature would deepen that problem.
    it('fetches collaborators for every visible list in a single batched call', async () => {
      const harness = buildHarness();
      const first = await harness.seedSharedList();
      const second = await harness.listService.create({
        name: 'Second list',
        description: null,
        ownerId: OWNER.id,
      });
      harness.collaborators.findByListsCalls.length = 0;

      const summaries = await harness.viewService.summariesFor(OWNER.id);

      assert.strictEqual(summaries.length, 2);
      assert.strictEqual(harness.collaborators.findByListsCalls.length, 1);
      assert.deepStrictEqual(
        harness.collaborators.findByListsCalls[0].sort(),
        [first.id, second.id].sort()
      );
    });
  });

  describe('invites', () => {
    it('lists a pending invite with an item count but resolves no summaries for it', async () => {
      const harness = buildHarness();
      const list = await harness.listService.create({
        name: 'Film club',
        ownerId: OWNER.id,
      });
      await addMovies(harness, list.id, [1, 2]);
      await harness.collaboratorService.share({
        listId: list.id,
        recipientId: STRANGER.id,
        role: CollaboratorRole.READ,
        actor: OWNER,
      });

      const invites = await harness.viewService.invitesFor(STRANGER.id);

      assert.strictEqual(invites.length, 1);
      assert.strictEqual(invites[0].list.id, list.id);
      assert.strictEqual(invites[0].itemCount, 2);
      assert.strictEqual(invites[0].role, CollaboratorRole.READ);
      assert.strictEqual(invites[0].invitedBy?.id, OWNER.id);
    });

    it('drops an invite once it is accepted', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await harness.collaboratorService.share({
        listId: list.id,
        recipientId: STRANGER.id,
        role: CollaboratorRole.READ,
        actor: OWNER,
      });

      await harness.collaboratorService.acceptInvite({
        listId: list.id,
        userId: STRANGER.id,
      });

      assert.deepStrictEqual(
        await harness.viewService.invitesFor(STRANGER.id),
        []
      );
    });

    it('returns nothing for someone with no invites', async () => {
      const harness = buildHarness();
      await harness.seedSharedList();

      assert.deepStrictEqual(
        await harness.viewService.invitesFor(STRANGER.id),
        []
      );
    });
  });

  describe('what each screen resolves', () => {
    // The index shows counts and a short poster strip, so resolving a title for every
    // item on every list would be a TMDB lookup nobody sees.
    it('only resolves titles for the preview on the index', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      harness.summaryCalls.length = 0;

      const [summary] = await harness.viewService.summariesFor(OWNER.id);

      assert.strictEqual(summary.itemCount, 9);
      assert.strictEqual(harness.summaryCalls.length, 7);
    });

    it('resolves a title for every item on the detail page', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      harness.summaryCalls.length = 0;

      const views = await harness.viewService.itemViewsFor(list.id, OWNER.id);

      assert.strictEqual(views.length, 9);
      assert.strictEqual(harness.summaryCalls.length, 9);
      assert.strictEqual(views[0].summary?.title, 'Title 1');
    });

    // A ring reading 0/0 is worse than the extra cached lookup, so the detail page asks
    // for the episode count of a series nobody has started.
    it('knows the episode total of an unstarted series on the detail page', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      harness.tv.setSeasons([{ seasonNumber: 1, episodeCount: 20 }]);
      await harness.itemService.add({
        listId: list.id,
        tmdbId: 500,
        mediaType: MediaType.TV,
        actor: OWNER,
      });

      const [onDetail] = await harness.viewService.itemViewsFor(
        list.id,
        OWNER.id
      );

      assert.strictEqual(onDetail.progress?.watchedEpisodes, 0);
      assert.strictEqual(onDetail.progress?.totalEpisodes, 20);
    });
  });

  describe('item views', () => {
    it('refuses someone the list was not shared with', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();

      await assert.rejects(
        () => harness.viewService.itemViewsFor(list.id, STRANGER.id),
        MediaListAccessDeniedError
      );
    });

    it('reports the caller own state and who else finished a title', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [1]);
      const [item] = await harness.itemService.itemsOf(list.id, OWNER.id);
      await harness.watchService.setMovieWatched(
        list.id,
        item.id,
        WRITER.id,
        true
      );

      const [forOwner] = await harness.viewService.itemViewsFor(
        list.id,
        OWNER.id
      );

      assert.strictEqual(forOwner.watched, false);
      assert.deepStrictEqual(forOwner.seenByUserIds, [WRITER.id]);
      assert.strictEqual(forOwner.progress, null);
    });

    it('filters by the caller own state', async () => {
      const harness = buildHarness();
      const list = await harness.seedSharedList();
      await addMovies(harness, list.id, [1, 2]);
      const items = await harness.itemService.itemsOf(list.id, OWNER.id);
      await harness.watchService.setMovieWatched(
        list.id,
        items[1].id,
        OWNER.id,
        true
      );

      const seen = await harness.viewService.itemViewsFor(
        list.id,
        OWNER.id,
        'seen'
      );
      const unseen = await harness.viewService.itemViewsFor(
        list.id,
        OWNER.id,
        'unseen'
      );

      assert.deepStrictEqual(
        seen.map((view) => view.item.tmdbId),
        [2]
      );
      assert.deepStrictEqual(
        unseen.map((view) => view.item.tmdbId),
        [1]
      );
    });
  });
});
