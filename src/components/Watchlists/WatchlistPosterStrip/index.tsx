import CachedImage from '@app/components/Common/CachedImage';
import RequestButton from '@app/components/RequestButton';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import type { MediaListRef } from '@app/domain/mediaLists/models/MediaList';
import { useIsTouch } from '@app/hooks/useIsTouch';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import {
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistPosterStrip', {
  add: 'Add',
  addtitles: 'Add titles to {name}',
  empty: 'Nothing on this list yet',
  markseen: 'Mark seen',
  markunseen: 'Mark unseen',
  remove: 'Remove',
  removed: 'Removed from the watchlist.',
  removefailed: 'Something went wrong removing that title.',
  seenfailed: 'Something went wrong updating your watched state.',
});

interface WatchlistPosterStripProps {
  listId: number;
  name: string;
  previewItems: MediaListRef[];
  // The add tile and hover CTAs only appear for members who may actually change the list.
  canAdd: boolean;
  onAdd: () => void;
}

const WatchlistPosterStrip = ({
  listId,
  name,
  previewItems,
  canAdd,
  onAdd,
}: WatchlistPosterStripProps) => {
  const intl = useIntl();
  const isTouch = useIsTouch();
  const { addToast } = useToasts();
  const { setMovieWatched, removeItem } = useMediaListMutations(listId);

  const onToggleSeen = async (item: MediaListRef) => {
    try {
      await setMovieWatched(item.id, !item.watched);
    } catch {
      addToast(intl.formatMessage(messages.seenfailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const onRemove = async (item: MediaListRef) => {
    try {
      await removeItem(item.id);
      addToast(intl.formatMessage(messages.removed), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.removefailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  return (
    <div className="flex gap-3 overflow-hidden">
      {previewItems.map((item) => (
        <div
          key={`${item.mediaType}-${item.tmdbId}`}
          className="group relative aspect-[2/3] w-[108px] flex-none overflow-hidden rounded-lg shadow ring-1 ring-gray-700 transition duration-150 hover:ring-gray-500"
        >
          <Link
            href={
              item.mediaType === 'tv'
                ? `/tv/${item.tmdbId}`
                : `/movie/${item.tmdbId}`
            }
            className="absolute inset-0"
          >
            {item.posterPath ? (
              <CachedImage
                type="tmdb"
                src={`https://image.tmdb.org/t/p/w300_and_h450_face${item.posterPath}`}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gray-800" />
            )}
          </Link>

          {canAdd && !isTouch && (
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gray-900 bg-opacity-0 p-1.5 opacity-0 transition duration-150 group-hover:bg-opacity-70 group-hover:opacity-100">
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onToggleSeen(item)}
                  aria-label={intl.formatMessage(
                    item.watched ? messages.markunseen : messages.markseen
                  )}
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 bg-opacity-90 text-gray-100 ring-1 ring-gray-600 transition duration-150 hover:bg-gray-700"
                >
                  {item.watched ? (
                    <EyeIcon className="h-3.5 w-3.5" />
                  ) : (
                    <EyeSlashIcon className="h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  aria-label={intl.formatMessage(messages.remove)}
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 bg-opacity-90 text-gray-100 ring-1 ring-gray-600 transition duration-150 hover:bg-red-900 hover:text-red-200"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="pointer-events-auto flex justify-center [&>*]:w-full [&_button]:w-full">
                <RequestButton
                  mediaType={item.mediaType === 'tv' ? 'tv' : 'movie'}
                  tmdbId={item.tmdbId}
                  onUpdate={() => undefined}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={intl.formatMessage(messages.addtitles, { name })}
          className="flex aspect-[2/3] w-[108px] flex-none flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 text-gray-500 transition duration-150 hover:border-gray-500 hover:text-gray-400"
        >
          <PlusIcon className="h-6 w-6" />
          <span className="text-xs">{intl.formatMessage(messages.add)}</span>
        </button>
      )}

      {previewItems.length === 0 && !canAdd && (
        <span className="self-center text-sm text-gray-500">
          {intl.formatMessage(messages.empty)}
        </span>
      )}
    </div>
  );
};

export default WatchlistPosterStrip;
