import type { EpisodeRef } from '@server/features/mediaLists/domain/valueObjects/WatchProgress';

// Every method is scoped to one user. Watched state is personal: a member records their
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

  // Users who have a movie watch record, used to build the seen-by badges. Show
  // completion is derived, so the caller resolves that from episode records instead.
  findUsersWhoWatchedMovie(itemId: number): Promise<number[]>;
  findWatchedEpisodeCountsByUser(
    itemId: number
  ): Promise<{ userId: number; episodes: EpisodeRef[] }[]>;
}
