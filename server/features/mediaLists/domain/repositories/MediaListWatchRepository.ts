import type { EpisodeRef } from '@server/features/mediaLists/domain/valueObjects/WatchProgress';

export interface MovieWatchRow {
  itemId: number;
  userId: number;
}

export interface EpisodeWatchRow extends EpisodeRef {
  itemId: number;
  userId: number;
}

// Writes are always scoped to one user. Watched state is personal: a member records their
// own progress and sees who else finished a title, and nobody writes anyone else's state.
export interface MediaListWatchRepository {
  isMovieWatched(itemId: number, userId: number): Promise<boolean>;
  setMovieWatched(itemId: number, userId: number): Promise<void>;
  clearMovieWatched(itemId: number, userId: number): Promise<void>;

  findWatchedEpisodes(itemId: number, userId: number): Promise<EpisodeRef[]>;
  setEpisodesWatched(
    itemId: number,
    userId: number,
    episodes: EpisodeRef[]
  ): Promise<void>;
  clearEpisodesWatched(
    itemId: number,
    userId: number,
    episodes: EpisodeRef[]
  ): Promise<void>;
  clearSeasonWatched(
    itemId: number,
    userId: number,
    seasonNumber: number
  ): Promise<void>;

  // Batched so assembling a list view costs a fixed number of queries rather than two
  // per item. Show completion is derived, so these return raw rows and the caller works
  // out who has actually finished a title.
  findMovieWatchesForItems(itemIds: number[]): Promise<MovieWatchRow[]>;
  findEpisodeWatchesForItems(itemIds: number[]): Promise<EpisodeWatchRow[]>;
}
