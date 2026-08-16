import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import WatchlistRequestButton from '@app/components/Watchlists/WatchlistRequestButton';
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
import { MediaStatus } from '@server/constants/media';
import Link from 'next/link';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistPosterStrip', {
  add: 'Add',
  addtitles: 'Add titles to {name}',
  empty: 'Nothing on this list yet.',
  markseen: 'Mark Seen',
  markunseen: 'Mark Unseen',
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

          {/* Status is worth seeing without hovering, the same way it is on a title
              card, so it sits outside the overlay below. */}
          {!!item.status && item.status !== MediaStatus.UNKNOWN && (
            <div className="pointer-events-none absolute right-1.5 top-1.5 z-40 flex">
              <StatusBadgeMini status={item.status} shrink />
            </div>
          )}

          {canAdd && !isTouch && (
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gray-900 bg-opacity-0 p-1.5 opacity-0 transition duration-150 group-hover:bg-opacity-70 group-hover:opacity-100">
              <div className="pointer-events-auto flex justify-end gap-1">
                <Button
                  buttonType={item.watched ? 'success' : 'default'}
                  buttonSize="sm"
                  onClick={() => onToggleSeen(item)}
                  title={intl.formatMessage(
                    item.watched ? messages.markunseen : messages.markseen
                  )}
                >
                  {item.watched ? <EyeIcon /> : <EyeSlashIcon />}
                </Button>

                <Button
                  buttonType="danger"
                  buttonSize="sm"
                  onClick={() => onRemove(item)}
                  title={intl.formatMessage(messages.remove)}
                >
                  <XMarkIcon />
                </Button>
              </div>

              <div className="pointer-events-auto flex justify-center">
                <WatchlistRequestButton
                  tmdbId={item.tmdbId}
                  mediaType={item.mediaType}
                  status={item.status}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {canAdd && (
        // A dashed drop-target tile rather than a Button: it is sized like the posters
        // beside it, which no button size would give.
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
