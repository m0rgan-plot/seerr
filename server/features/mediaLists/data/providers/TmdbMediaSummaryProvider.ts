import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import type {
  MediaSummary,
  MediaSummaryProvider,
} from '@server/features/mediaLists/domain/ports/MediaSummaryProvider';
import logger from '@server/logger';

const yearOf = (date?: string): number | null => {
  const year = Number(date?.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
};

export class TmdbMediaSummaryProvider implements MediaSummaryProvider {
  constructor(private readonly tmdb: TheMovieDb = new TheMovieDb()) {}

  public async getSummary(
    tmdbId: number,
    mediaType: MediaType
  ): Promise<MediaSummary | null> {
    try {
      if (mediaType === MediaType.MOVIE) {
        const movie = await this.tmdb.getMovie({ movieId: tmdbId });
        return {
          title: movie.title,
          posterPath: movie.poster_path ?? null,
          year: yearOf(movie.release_date),
        };
      }

      const show = await this.tmdb.getTvShow({ tvId: tmdbId });
      return {
        title: show.name,
        posterPath: show.poster_path ?? null,
        year: yearOf(show.first_air_date),
      };
    } catch (e) {
      // A title TMDB no longer knows about should leave a gap on the page rather than
      // fail the whole list.
      logger.debug('Unable to resolve watchlist title summary', {
        label: 'Media Lists',
        tmdbId,
        mediaType,
        errorMessage: e.message,
      });
      return null;
    }
  }
}
