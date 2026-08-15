import type TheMovieDb from '@server/api/themoviedb';
import { TmdbTvMetadataProvider } from '@server/features/mediaLists/data/providers/TmdbTvMetadataProvider';
import assert from 'node:assert';
import { describe, it } from 'node:test';

// TheMovieDb is passed in rather than reached for, so the snake_case TMDB shape can be
// checked against the domain shape without any network access.
const providerFor = (tmdb: Partial<TheMovieDb>) =>
  new TmdbTvMetadataProvider(tmdb as TheMovieDb);

describe('TmdbTvMetadataProvider', () => {
  it('maps the TMDB season list to season counts', async () => {
    const provider = providerFor({
      getTvShow: (async () => ({
        seasons: [
          { season_number: 0, episode_count: 4 },
          { season_number: 1, episode_count: 10 },
          { season_number: 2, episode_count: 8 },
        ],
      })) as unknown as TheMovieDb['getTvShow'],
    });

    assert.deepStrictEqual(await provider.getSeasonEpisodeCounts(1), [
      { seasonNumber: 0, episodeCount: 4 },
      { seasonNumber: 1, episodeCount: 10 },
      { seasonNumber: 2, episodeCount: 8 },
    ]);
  });

  it('passes the show id through', async () => {
    let received: number | undefined;
    const provider = providerFor({
      getTvShow: (async ({ tvId }: { tvId: number }) => {
        received = tvId;
        return { seasons: [] };
      }) as unknown as TheMovieDb['getTvShow'],
    });

    await provider.getSeasonEpisodeCounts(125988);

    assert.strictEqual(received, 125988);
  });

  it('maps a season to its episode numbers', async () => {
    const provider = providerFor({
      getTvSeason: (async () => ({
        episodes: [
          { episode_number: 1 },
          { episode_number: 2 },
          { episode_number: 3 },
        ],
      })) as unknown as TheMovieDb['getTvSeason'],
    });

    assert.deepStrictEqual(
      await provider.getSeasonEpisodeNumbers(1, 2),
      [1, 2, 3]
    );
  });

  it('returns nothing for a season with no episodes', async () => {
    const provider = providerFor({
      getTvSeason: (async () => ({
        episodes: [],
      })) as unknown as TheMovieDb['getTvSeason'],
    });

    assert.deepStrictEqual(await provider.getSeasonEpisodeNumbers(1, 9), []);
  });
});
