import type { MediaType } from '@server/constants/media';

// Poster art for the shelf strips on the index. Resolved server-side rather than by the
// browser: the client would need one request per poster, where this costs the same TMDB
// lookups behind the same cache and returns them in a single response.
export interface MediaArtworkProvider {
  getPosterPath(tmdbId: number, mediaType: MediaType): Promise<string | null>;
}
