import { MediaType } from '@server/constants/media';
import {
  InvalidWatchTargetError,
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

const seedList = async (harness: ReturnType<typeof buildHarness>) => {
  const list = await harness.seedSharedList();
  const movie = await harness.itemService.add({
    listId: list.id,
    tmdbId: 693134,
    mediaType: MediaType.MOVIE,
    actor: OWNER,
  });
  const show = await harness.itemService.add({
    listId: list.id,
    tmdbId: 125988,
    mediaType: MediaType.TV,
    actor: OWNER,
  });
  harness.tv.setSeasons([
    { seasonNumber: 1, episodeCount: 10 },
    { seasonNumber: 2, episodeCount: 10 },
  ]);
  return { list, movie, show };
};

describe('MediaListWatchService', () => {
  describe('movies', () => {
    it('marks and unmarks a movie for the caller', async () => {
      const harness = buildHarness();
      const { list, movie } = await seedList(harness);

      await harness.watchService.setMovieWatched(
        list.id,
        movie.id,
        OWNER.id,
        true
      );
      assert.strictEqual(
        await harness.watches.isMovieWatched(movie.id, OWNER.id),
        true
      );

      await harness.watchService.setMovieWatched(
        list.id,
        movie.id,
        OWNER.id,
        false
      );
      assert.strictEqual(
        await harness.watches.isMovieWatched(movie.id, OWNER.id),
        false
      );
    });

    it('refuses the movie action on a series', async () => {
      const harness = buildHarness();
      const { list, show } = await seedList(harness);

      await assert.rejects(
        () =>
          harness.watchService.setMovieWatched(
            list.id,
            show.id,
            OWNER.id,
            true
          ),
        InvalidWatchTargetError
      );
    });

    it('refuses the episode action on a movie', async () => {
      const harness = buildHarness();
      const { list, movie } = await seedList(harness);

      await assert.rejects(
        () =>
          harness.watchService.setEpisodeWatched(
            list.id,
            movie.id,
            OWNER.id,
            1,
            1,
            true
          ),
        InvalidWatchTargetError
      );
    });
  });

  describe('per-user isolation', () => {
    // The design is explicit that seen state is personal, so one member ticking an
    // episode must leave everyone else exactly where they were.
    it('keeps one member marking an episode out of another member state', async () => {
      const harness = buildHarness();
      const { list, show } = await seedList(harness);

      await harness.watchService.setEpisodeWatched(
        list.id,
        show.id,
        OWNER.id,
        1,
        1,
        true
      );

      const ownerProgress = await harness.watchService.progressFor(
        list.id,
        show.id,
        OWNER.id
      );
      const writerProgress = await harness.watchService.progressFor(
        list.id,
        show.id,
        WRITER.id
      );

      assert.strictEqual(ownerProgress.watchedEpisodes, 1);
      assert.strictEqual(writerProgress.watchedEpisodes, 0);
    });

    it('keeps movie state separate per member', async () => {
      const harness = buildHarness();
      const { list, movie } = await seedList(harness);

      await harness.watchService.setMovieWatched(
        list.id,
        movie.id,
        WRITER.id,
        true
      );

      assert.strictEqual(
        await harness.watches.isMovieWatched(movie.id, WRITER.id),
        true
      );
      assert.strictEqual(
        await harness.watches.isMovieWatched(movie.id, OWNER.id),
        false
      );
    });
  });

  describe('seasons', () => {
    it('marking a season writes every episode of that season', async () => {
      const harness = buildHarness();
      const { list, show } = await seedList(harness);

      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        1,
        true
      );

      const progress = await harness.watchService.progressFor(
        list.id,
        show.id,
        OWNER.id
      );
      const season1 = progress.seasons.find(
        (season) => season.seasonNumber === 1
      );
      assert.strictEqual(season1?.isComplete, true);
      assert.strictEqual(season1?.watchedEpisodes, 10);
      assert.strictEqual(progress.isComplete, false);
    });

    it('unmarking a season clears only that season', async () => {
      const harness = buildHarness();
      const { list, show } = await seedList(harness);

      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        1,
        true
      );
      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        2,
        true
      );
      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        1,
        false
      );

      const progress = await harness.watchService.progressFor(
        list.id,
        show.id,
        OWNER.id
      );
      assert.strictEqual(
        progress.seasons.find((season) => season.seasonNumber === 1)
          ?.watchedEpisodes,
        0
      );
      assert.strictEqual(
        progress.seasons.find((season) => season.seasonNumber === 2)
          ?.isComplete,
        true
      );
    });

    it('completes the show once every season is marked', async () => {
      const harness = buildHarness();
      const { list, show } = await seedList(harness);

      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        1,
        true
      );
      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        2,
        true
      );

      const progress = await harness.watchService.progressFor(
        list.id,
        show.id,
        OWNER.id
      );
      assert.strictEqual(progress.isComplete, true);
      assert.strictEqual(progress.watchedEpisodes, 20);
    });

    // There is no stored season flag, so a season that gains an episode reverts on its
    // own the next time progress is read.
    it('reverts completion when TMDB reports a new episode', async () => {
      const harness = buildHarness();
      const { list, show } = await seedList(harness);
      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        1,
        true
      );

      harness.tv.setSeasons([
        { seasonNumber: 1, episodeCount: 11 },
        { seasonNumber: 2, episodeCount: 10 },
      ]);

      const progress = await harness.watchService.progressFor(
        list.id,
        show.id,
        OWNER.id
      );
      assert.strictEqual(
        progress.seasons.find((season) => season.seasonNumber === 1)
          ?.isComplete,
        false
      );
    });

    it('does nothing for a season with no episodes', async () => {
      const harness = buildHarness();
      const { list, show } = await seedList(harness);

      await harness.watchService.setSeasonWatched(
        list.id,
        show.id,
        OWNER.id,
        99,
        true
      );

      assert.strictEqual(harness.watches.episodeWatches.size, 0);
    });
  });

  describe('access', () => {
    // The one mutation a read-only collaborator is allowed, because it writes their own
    // state rather than the list.
    it('lets a read-only collaborator record their own progress', async () => {
      const harness = buildHarness();
      const { list, movie } = await seedList(harness);

      await harness.watchService.setMovieWatched(
        list.id,
        movie.id,
        READER.id,
        true
      );

      assert.strictEqual(
        await harness.watches.isMovieWatched(movie.id, READER.id),
        true
      );
    });

    it('refuses a stranger', async () => {
      const harness = buildHarness();
      const { list, movie } = await seedList(harness);

      await assert.rejects(
        () =>
          harness.watchService.setMovieWatched(
            list.id,
            movie.id,
            STRANGER.id,
            true
          ),
        MediaListAccessDeniedError
      );
    });

    it('refuses an item from another list', async () => {
      const harness = buildHarness();
      const { movie } = await seedList(harness);
      const other = await harness.listService.create({
        name: 'Other',
        ownerId: OWNER.id,
      });

      await assert.rejects(
        () =>
          harness.watchService.setMovieWatched(
            other.id,
            movie.id,
            OWNER.id,
            true
          ),
        ItemNotFoundInListError
      );
    });
  });
});
