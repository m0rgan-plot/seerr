import type {
  EpisodeRef,
  SeasonProgress,
} from '@app/domain/mediaLists/models/MediaListItem';
import { episodeKey } from '@app/domain/mediaLists/models/MediaListItem';
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
  specials: 'Specials',
  episodecount: '{count, plural, one {# episode} other {# episodes}}',
  allseen: 'All seen',
  someseen: '{count} seen',
  markseason: 'Mark season seen',
  unmarkseason: 'Mark season unseen',
  episode: 'S{season}E{episode}',
  loading: 'Loading episodes',
});

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
    <div className="rounded-lg bg-gray-900">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex flex-1 items-center gap-3 text-left"
        >
          {expanded ? (
            <ChevronDownIcon className="h-4 w-4 flex-none text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 flex-none text-gray-500" />
          )}
          <span className="w-24 flex-none text-sm font-semibold text-gray-200">
            {season.seasonNumber === 0
              ? intl.formatMessage(messages.specials)
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

        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleSeason(!season.isComplete)}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition duration-150 disabled:opacity-50 ${
            season.isComplete
              ? 'border-green-500 bg-green-500 bg-opacity-20 text-green-200'
              : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
          }`}
        >
          {season.isComplete && <CheckIcon className="h-3.5 w-3.5" />}
          {intl.formatMessage(
            season.isComplete ? messages.unmarkseason : messages.markseason
          )}
        </button>
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
                    season: season.seasonNumber,
                    episode: episode.episodeNumber,
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
