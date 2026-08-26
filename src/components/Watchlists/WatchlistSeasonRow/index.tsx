import Button from '@app/components/Common/Button';
import type {
  EpisodeRef,
  SeasonProgress,
} from '@app/domain/mediaLists/models/MediaListItem';
import { episodeKey } from '@app/domain/mediaLists/models/MediaListItem';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { SeasonWithEpisodes } from '@server/models/Tv';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Watchlists.WatchlistSeasonRow', {
  season: 'Season {number}',
  episodecount: '{count, plural, one {# episode} other {# episodes}}',
  allseen: 'All Seen',
  someseen: '{count} seen',
  markseason: 'Mark Season Seen',
  unmarkseason: 'Mark Season Unseen',
  episode: 'S{season}E{episode}',
  loading: 'Loading episodes…',
  expand: 'Show episodes of {season}',
});

// Season and episode numbers read as a pair, so they are padded to a fixed width the way
// every other tool that names an episode does it.
const pad = (value: number) => String(value).padStart(2, '0');

interface WatchlistSeasonRowProps {
  tmdbId: number;
  season: SeasonProgress;
  watchedEpisodes: EpisodeRef[];
  expanded: boolean;
  busy: boolean;
  onToggleExpanded: () => void;
  onToggleSeason: (watched: boolean) => void;
  onToggleEpisode: (episodeNumber: number, watched: boolean) => void;
}

const WatchlistSeasonRow = ({
  tmdbId,
  season,
  watchedEpisodes,
  expanded,
  busy,
  onToggleExpanded,
  onToggleSeason,
  onToggleEpisode,
}: WatchlistSeasonRowProps) => {
  const intl = useIntl();

  // Episode titles come from the same endpoint the series page uses, and only once the
  // season is actually open.
  const { data } = useSWR<SeasonWithEpisodes>(
    expanded ? `/api/v1/tv/${tmdbId}/season/${season.seasonNumber}` : null
  );

  const watched = new Set(watchedEpisodes.map(episodeKey));
  const isWatched = (episodeNumber: number) =>
    watched.has(
      episodeKey({ seasonNumber: season.seasonNumber, episodeNumber })
    );

  const percent =
    season.totalEpisodes > 0
      ? Math.round((season.watchedEpisodes / season.totalEpisodes) * 100)
      : 0;

  return (
    <div data-testid="watchlist-season" className="rounded-lg bg-gray-900">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <button
          type="button"
          data-testid="watchlist-season-toggle"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={intl.formatMessage(messages.expand, {
            season:
              season.seasonNumber === 0
                ? intl.formatMessage(globalMessages.specials)
                : intl.formatMessage(messages.season, {
                    number: season.seasonNumber,
                  }),
          })}
          className="flex flex-1 items-center gap-3 text-left"
        >
          {expanded ? (
            <ChevronDownIcon className="h-4 w-4 flex-none text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 flex-none text-gray-500" />
          )}
          <span className="w-24 flex-none text-sm font-semibold text-gray-200">
            {season.seasonNumber === 0
              ? intl.formatMessage(globalMessages.specials)
              : intl.formatMessage(messages.season, {
                  number: season.seasonNumber,
                })}
          </span>
          <span className="w-24 flex-none text-xs text-gray-400">
            {intl.formatMessage(messages.episodecount, {
              count: season.totalEpisodes,
            })}
          </span>

          <span className="hidden h-1 max-w-[220px] flex-1 overflow-hidden rounded-full bg-gray-700 sm:block">
            <span
              className={`block h-full ${
                season.isComplete ? 'bg-green-500' : 'bg-indigo-400'
              }`}
              style={{ width: `${percent}%` }}
            />
          </span>

          <span
            className={`w-20 flex-none text-right text-xs ${
              season.isComplete ? 'text-green-200' : 'text-gray-400'
            }`}
          >
            {season.isComplete
              ? intl.formatMessage(messages.allseen)
              : intl.formatMessage(messages.someseen, {
                  count: season.watchedEpisodes,
                })}
          </span>
        </button>

        <Button
          buttonType={season.isComplete ? 'success' : 'default'}
          buttonSize="sm"
          disabled={busy}
          onClick={() => onToggleSeason(!season.isComplete)}
        >
          <CheckIcon />
          <span>
            {intl.formatMessage(
              season.isComplete ? messages.unmarkseason : messages.markseason
            )}
          </span>
        </Button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-1 px-3 pb-3">
          {!data && (
            <div className="py-2 text-xs text-gray-500">
              {intl.formatMessage(messages.loading)}
            </div>
          )}

          {data?.episodes.map((episode) => {
            const ticked = isWatched(episode.episodeNumber);

            return (
              <button
                key={episode.id}
                data-testid="watchlist-episode"
                type="button"
                disabled={busy}
                onClick={() => onToggleEpisode(episode.episodeNumber, !ticked)}
                className="flex items-center gap-3 rounded-md bg-gray-800 px-3 py-1.5 text-left transition duration-150 hover:bg-gray-700 disabled:opacity-50"
              >
                <span
                  className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded border ${
                    ticked
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-gray-500 bg-gray-900'
                  }`}
                >
                  {ticked && <CheckIcon className="h-3 w-3" />}
                </span>
                <span className="w-12 flex-none font-mono text-[11px] text-gray-500">
                  {intl.formatMessage(messages.episode, {
                    season: pad(season.seasonNumber),
                    episode: pad(episode.episodeNumber),
                  })}
                </span>
                <span className="flex-1 truncate text-sm text-gray-200">
                  {episode.name}
                </span>
                {episode.airDate && (
                  <span className="hidden flex-none text-[11px] text-gray-500 sm:block">
                    {episode.airDate}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WatchlistSeasonRow;
