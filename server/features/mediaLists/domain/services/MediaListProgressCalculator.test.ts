import { MediaListProgressCalculator } from '@server/features/mediaLists/domain/services/MediaListProgressCalculator';
import type {
  EpisodeRef,
  SeasonEpisodeCount,
} from '@server/features/mediaLists/domain/valueObjects/WatchProgress';
import assert from 'node:assert';
import { describe, it } from 'node:test';

const calculator = new MediaListProgressCalculator();

const episodes = (seasonNumber: number, count: number): EpisodeRef[] =>
  Array.from({ length: count }, (_, i) => ({
    seasonNumber,
    episodeNumber: i + 1,
  }));

const twoSeasons: SeasonEpisodeCount[] = [
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 10 },
];

describe('MediaListProgressCalculator', () => {
  describe('seasonProgress', () => {
    const cases = [
      { name: 'nothing watched', watched: 0, total: 10, complete: false },
      { name: 'partially watched', watched: 4, total: 10, complete: false },
      { name: 'fully watched', watched: 10, total: 10, complete: true },
    ];

    for (const testCase of cases) {
      it(`reports ${testCase.name}`, () => {
        const progress = calculator.seasonProgress(
          1,
          testCase.total,
          episodes(1, testCase.watched)
        );
        assert.strictEqual(progress.watchedEpisodes, testCase.watched);
        assert.strictEqual(progress.totalEpisodes, testCase.total);
        assert.strictEqual(progress.isComplete, testCase.complete);
      });
    }

    it('ignores episodes belonging to other seasons', () => {
      const progress = calculator.seasonProgress(2, 10, [
        ...episodes(1, 10),
        ...episodes(2, 3),
      ]);
      assert.strictEqual(progress.watchedEpisodes, 3);
      assert.strictEqual(progress.isComplete, false);
    });

    it('is never complete when the season has no episodes yet', () => {
      const progress = calculator.seasonProgress(3, 0, []);
      assert.strictEqual(progress.isComplete, false);
      assert.strictEqual(progress.totalEpisodes, 0);
    });

    it('clamps when more episodes are watched than TMDB now reports', () => {
      const progress = calculator.seasonProgress(1, 8, episodes(1, 10));
      assert.strictEqual(progress.watchedEpisodes, 8);
      assert.strictEqual(progress.isComplete, true);
    });
  });

  describe('showProgress', () => {
    it('sums across seasons', () => {
      const progress = calculator.showProgress(twoSeasons, [
        ...episodes(1, 10),
        ...episodes(2, 2),
      ]);
      assert.strictEqual(progress.watchedEpisodes, 12);
      assert.strictEqual(progress.totalEpisodes, 20);
      assert.strictEqual(progress.isComplete, false);
    });

    it('is complete only when every regular season is finished', () => {
      const progress = calculator.showProgress(twoSeasons, [
        ...episodes(1, 10),
        ...episodes(2, 10),
      ]);
      assert.strictEqual(progress.isComplete, true);
      assert.strictEqual(progress.watchedEpisodes, 20);
    });

    // The reason season state is derived rather than stored: a finished show stops
    // reading as finished by itself once TMDB adds an episode.
    it('stops being complete when a season later gains an episode', () => {
      const watched = [...episodes(1, 10), ...episodes(2, 10)];
      const grown: SeasonEpisodeCount[] = [
        { seasonNumber: 1, episodeCount: 10 },
        { seasonNumber: 2, episodeCount: 11 },
      ];

      assert.strictEqual(
        calculator.showProgress(twoSeasons, watched).isComplete,
        true
      );
      assert.strictEqual(
        calculator.showProgress(grown, watched).isComplete,
        false
      );
    });

    it('does not let unwatched specials block completion', () => {
      const withSpecials: SeasonEpisodeCount[] = [
        { seasonNumber: 0, episodeCount: 5 },
        ...twoSeasons,
      ];
      const progress = calculator.showProgress(withSpecials, [
        ...episodes(1, 10),
        ...episodes(2, 10),
      ]);

      assert.strictEqual(progress.isComplete, true);
      // Specials stay visible and trackable, they just sit outside the totals.
      assert.strictEqual(progress.totalEpisodes, 20);
      assert.strictEqual(
        progress.seasons.find((season) => season.seasonNumber === 0)
          ?.totalEpisodes,
        5
      );
    });

    it('ignores announced seasons that have no episodes yet', () => {
      const withEmpty: SeasonEpisodeCount[] = [
        ...twoSeasons,
        { seasonNumber: 3, episodeCount: 0 },
      ];
      const progress = calculator.showProgress(withEmpty, [
        ...episodes(1, 10),
        ...episodes(2, 10),
      ]);

      assert.strictEqual(progress.isComplete, true);
      assert.strictEqual(progress.totalEpisodes, 20);
    });

    it('is not complete for a show with no episode data at all', () => {
      const progress = calculator.showProgress([], []);
      assert.strictEqual(progress.isComplete, false);
      assert.strictEqual(progress.totalEpisodes, 0);
    });
  });

  describe('hasFinishedShow', () => {
    it('matches showProgress completion', () => {
      assert.strictEqual(
        calculator.hasFinishedShow(twoSeasons, [
          ...episodes(1, 10),
          ...episodes(2, 10),
        ]),
        true
      );
      assert.strictEqual(
        calculator.hasFinishedShow(twoSeasons, episodes(1, 10)),
        false
      );
    });
  });
});
