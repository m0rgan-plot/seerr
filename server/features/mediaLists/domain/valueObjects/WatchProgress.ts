// What TMDB reports for a show, reduced to the only thing progress needs.
export interface SeasonEpisodeCount {
  seasonNumber: number;
  episodeCount: number;
}

export interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

export interface SeasonProgress {
  seasonNumber: number;
  watchedEpisodes: number;
  totalEpisodes: number;
  isComplete: boolean;
}

export interface ShowProgress {
  seasons: SeasonProgress[];
  watchedEpisodes: number;
  totalEpisodes: number;
  isComplete: boolean;
}

export const episodeRefKey = ({
  seasonNumber,
  episodeNumber,
}: EpisodeRef): string => `${seasonNumber}:${episodeNumber}`;
