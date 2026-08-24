import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import WatchlistSeasonRow from '@app/components/Watchlists/WatchlistSeasonRow';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import { useItemProgress } from '@app/domain/mediaLists/hooks/useMediaLists';
import type { MediaListItem } from '@app/domain/mediaLists/models/MediaListItem';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.Watchlists.WatchlistEpisodeTracker',
  {
    seenprogress: "You've seen {watched} of {total}",
    markallseen: 'Mark all seen',
    markallunseen: 'Mark all unseen',
    close: 'Close episode tracking',
    seasoncount: '{count, plural, one {# season} other {# seasons}}',
    failed: 'Something went wrong updating your watched state.',
    nodata: 'No episode information is available for this title.',
  }
);

interface WatchlistEpisodeTrackerProps {
  mediaListId: number;
  item: MediaListItem;
  onClose: () => void;
  onChanged: () => void;
}

const WatchlistEpisodeTracker = ({
  mediaListId,
  item,
  onClose,
  onChanged,
}: WatchlistEpisodeTrackerProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { setSeasonWatched, setEpisodeWatched } =
    useMediaListMutations(mediaListId);

  const { data, isLoading, revalidate } = useItemProgress(mediaListId, item.id);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Every write refreshes both the accordion and the grid card behind it, since the
  // ring and the seen overlay are derived from the same records.
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      revalidate();
      onChanged();
    } catch {
      addToast(intl.formatMessage(messages.failed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const seasons = data?.progress.seasons ?? [];
  const trackable = seasons.filter((season) => season.totalEpisodes > 0);
  const isComplete = data?.progress.isComplete ?? false;

  return (
    <div className="col-span-full rounded-xl bg-gray-800 p-4 ring-1 ring-gray-600">
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative aspect-[2/3] w-14 flex-none overflow-hidden rounded bg-gray-900">
          {item.posterPath && (
            <CachedImage
              type="tmdb"
              src={`https://image.tmdb.org/t/p/w300_and_h450_face${item.posterPath}`}
              alt=""
              fill
              className="object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-gray-100">{item.title}</div>
          <div className="mt-0.5 text-xs text-gray-400">
            {[
              item.year,
              trackable.length
                ? intl.formatMessage(messages.seasoncount, {
                    count: trackable.length,
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>

          {data && data.progress.totalEpisodes > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-gray-700">
                <span
                  className="block h-full bg-gradient-to-r from-indigo-600 to-purple-600"
                  style={{
                    width: `${Math.round(
                      (data.progress.watchedEpisodes /
                        data.progress.totalEpisodes) *
                        100
                    )}%`,
                  }}
                />
              </span>
              <span className="text-xs text-gray-400">
                {intl.formatMessage(messages.seenprogress, {
                  watched: data.progress.watchedEpisodes,
                  total: data.progress.totalEpisodes,
                })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {trackable.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  for (const season of trackable) {
                    await setSeasonWatched(
                      item.id,
                      season.seasonNumber,
                      !isComplete
                    );
                  }
                })
              }
              className="rounded-md border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-100 transition duration-150 hover:bg-gray-600 disabled:opacity-50"
            >
              {intl.formatMessage(
                isComplete ? messages.markallunseen : messages.markallseen
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={intl.formatMessage(messages.close)}
            className="rounded p-1 text-gray-400 transition duration-150 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {isLoading && <LoadingSpinner />}

        {!isLoading && trackable.length === 0 && (
          <p className="py-2 text-sm text-gray-500">
            {intl.formatMessage(messages.nodata)}
          </p>
        )}

        {trackable.map((season) => (
          <WatchlistSeasonRow
            key={season.seasonNumber}
            tmdbId={item.tmdbId}
            season={season}
            watchedEpisodes={data?.episodes ?? []}
            expanded={expanded === season.seasonNumber}
            busy={busy}
            onToggleExpanded={() =>
              setExpanded((current) =>
                current === season.seasonNumber ? null : season.seasonNumber
              )
            }
            onToggleSeason={(watched) =>
              run(() => setSeasonWatched(item.id, season.seasonNumber, watched))
            }
            onToggleEpisode={(episodeNumber, watched) =>
              run(() =>
                setEpisodeWatched(
                  item.id,
                  season.seasonNumber,
                  episodeNumber,
                  watched
                )
              )
            }
          />
        ))}
      </div>
    </div>
  );
};

export default WatchlistEpisodeTracker;
