import type { MediaType } from '@server/constants/media';

export interface MediaSummary {
  title: string;
  // Relative TMDB path, or null when there is no art.
  posterPath: string | null;
  year: number | null;
}

// Title, art and year for a tmdb id. Resolved server-side rather than by the browser: the
// client would need a request per title, where this costs the same TMDB lookups behind the
// same cache and returns them with the list.
export interface MediaSummaryProvider {
  getSummary(
    tmdbId: number,
    mediaType: MediaType
  ): Promise<MediaSummary | null>;
}
