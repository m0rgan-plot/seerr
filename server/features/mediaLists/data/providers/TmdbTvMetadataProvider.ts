import TheMovieDb from '@server/api/themoviedb';
import type { TvMetadataProvider } from '@server/features/mediaLists/domain/ports/TvMetadataProvider';
import type { SeasonEpisodeCount } from '@server/features/mediaLists/domain/valueObjects/WatchProgress';
import logger from '@server/logger';

// Reads go through TheMovieDb, which caches responses via ExternalAPI, so deriving
// progress on every request does not turn into a TMDB call per item.
export class TmdbTvMetadataProvider implements TvMetadataProvider {
  constructor(private readonly tmdb: TheMovieDb = new TheMovieDb()) {}

  public async getSeasonEpisodeCounts(
    tmdbId: number
  ): Promise<SeasonEpisodeCount[]> {
    try {
      const show = await this.tmdb.getTvShow({ tvId: tmdbId });

      return show.seasons.map((season) => ({
        seasonNumber: season.season_number,
        episodeCount: season.episode_count,
      }));
    } catch (e) {
      // Progress is derived from these counts on every read of every list holding the
      // title, so letting one unknown id throw would take the whole page down for good.
      // Without counts the show simply reads as zero episodes.
      logger.debug('Unable to resolve watchlist season counts', {
        label: 'Media Lists',
        tmdbId,
        errorMessage: e.message,
      });
      return [];
    }
  }

  public async getSeasonEpisodeNumbers(
    tmdbId: number,
    seasonNumber: number
  ): Promise<number[]> {
    const season = await this.tmdb.getTvSeason({ tvId: tmdbId, seasonNumber });

    return season.episodes.map((episode) => episode.episode_number);
  }
}
