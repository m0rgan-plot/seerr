import type {
  EpisodeRef,
  SeasonEpisodeCount,
  SeasonProgress,
  ShowProgress,
} from '@server/features/mediaLists/domain/valueObjects/WatchProgress';

// Season 0 holds specials. They are tracked if someone ticks them, but they never count
// toward a show reading as finished, matching how the request modal already treats them.
const SPECIALS_SEASON = 0;

const countsTowardShow = ({ seasonNumber, episodeCount }: SeasonEpisodeCount) =>
  seasonNumber !== SPECIALS_SEASON && episodeCount > 0;

export class MediaListProgressCalculator {
  public seasonProgress(
    seasonNumber: number,
    totalEpisodes: number,
    watchedEpisodes: EpisodeRef[]
  ): SeasonProgress {
    const watched = watchedEpisodes.filter(
      (episode) => episode.seasonNumber === seasonNumber
    ).length;

    // TMDB can report fewer episodes than someone already ticked, for instance after a
    // season is restructured. Clamp so the UI never shows 12 of 10.
    const bounded = Math.min(watched, totalEpisodes);

    return {
      seasonNumber,
      watchedEpisodes: bounded,
      totalEpisodes,
      isComplete: totalEpisodes > 0 && bounded >= totalEpisodes,
    };
  }

  public showProgress(
    seasonCounts: SeasonEpisodeCount[],
    watchedEpisodes: EpisodeRef[]
  ): ShowProgress {
    const seasons = seasonCounts.map((season) =>
      this.seasonProgress(
        season.seasonNumber,
        season.episodeCount,
        watchedEpisodes
      )
    );

    const counted = seasons.filter((season) =>
      countsTowardShow({
        seasonNumber: season.seasonNumber,
        episodeCount: season.totalEpisodes,
      })
    );

    const watched = counted.reduce(
      (total, season) => total + season.watchedEpisodes,
      0
    );
    const total = counted.reduce(
      (sum, season) => sum + season.totalEpisodes,
      0
    );

    return {
      seasons,
      watchedEpisodes: watched,
      totalEpisodes: total,
      isComplete: total > 0 && counted.every((season) => season.isComplete),
    };
  }

  // A show counts as seen for the seen-by badges only once every regular season is done.
  public hasFinishedShow(
    seasonCounts: SeasonEpisodeCount[],
    watchedEpisodes: EpisodeRef[]
  ): boolean {
    return this.showProgress(seasonCounts, watchedEpisodes).isComplete;
  }
}
