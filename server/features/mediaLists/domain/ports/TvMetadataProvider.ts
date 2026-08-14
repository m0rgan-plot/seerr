import type { SeasonEpisodeCount } from '@server/features/mediaLists/domain/valueObjects/WatchProgress';

// Episode data is never persisted by this feature. Season and show completion are
// derived against whatever TMDB currently reports, so a season that later gains an
// episode stops reading as complete on its own.
export interface TvMetadataProvider {
  getSeasonEpisodeCounts(tmdbId: number): Promise<SeasonEpisodeCount[]>;
  getSeasonEpisodeNumbers(
    tmdbId: number,
    seasonNumber: number
  ): Promise<number[]>;
}
