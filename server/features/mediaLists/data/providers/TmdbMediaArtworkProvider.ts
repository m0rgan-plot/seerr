import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import type { MediaArtworkProvider } from '@server/features/mediaLists/domain/ports/MediaArtworkProvider';
import logger from '@server/logger';

export class TmdbMediaArtworkProvider implements MediaArtworkProvider {
  constructor(private readonly tmdb: TheMovieDb = new TheMovieDb()) {}

  public async getPosterPath(
    tmdbId: number,
    mediaType: MediaType
  ): Promise<string | null> {
    try {
      const details =
        mediaType === MediaType.MOVIE
          ? await this.tmdb.getMovie({ movieId: tmdbId })
          : await this.tmdb.getTvShow({ tvId: tmdbId });

      return details.poster_path ?? null;
    } catch (e) {
      // Artwork is decoration. A title TMDB no longer knows about should leave a gap on
      // the shelf rather than fail the whole index.
      logger.debug('Unable to resolve watchlist poster', {
        label: 'Media Lists',
        tmdbId,
        mediaType,
        errorMessage: e.message,
      });
      return null;
    }
  }
}
