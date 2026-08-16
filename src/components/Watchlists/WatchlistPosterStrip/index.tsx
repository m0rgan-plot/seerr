import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import RemoveWatchlistItemModal from '@app/components/Watchlists/RemoveWatchlistItemModal';
import WatchlistRequestButton from '@app/components/Watchlists/WatchlistRequestButton';
import WatchlistStatusDot from '@app/components/Watchlists/WatchlistStatusDot';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import type { MediaListRef } from '@app/domain/mediaLists/models/MediaList';
import useClickOutside from '@app/hooks/useClickOutside';
import { useIsTouch } from '@app/hooks/useIsTouch';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { CheckIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
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
  const [removing, setRemoving] = useState<MediaListRef | null>(null);
  // Touch has no hover, so a tap stands in for it: the first tap on a poster reveals
  // its actions instead of navigating, and a second tap (or a tap elsewhere) proceeds
  // normally. Keyed rather than boolean so revealing one poster hides any other.
  const [tappedKey, setTappedKey] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  // A tap outside the whole strip (not just a tap on a different poster, which the
  // posters' own click handlers already reassign) clears the reveal entirely.
  useClickOutside(
    stripRef,
    useCallback(() => setTappedKey(null), [])
  );

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
    <div ref={stripRef} className="flex gap-3 overflow-x-auto p-2">
      {canAdd && (
        // A dashed drop-target tile rather than a Button: it is sized like the posters
        // beside it, which no button size would give. First in the row, since that is
        // where a newly added title lands once the list re-sorts to show it.
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

      {previewItems.map((item) => {
        const key = `${item.mediaType}-${item.tmdbId}`;
        const tapped = isTouch && tappedKey === key;

        return (
          <div
            key={key}
            className="group relative aspect-[2/3] w-[108px] flex-none transform-gpu overflow-hidden rounded-lg shadow ring-1 ring-gray-700 transition duration-150 hover:scale-105 hover:ring-gray-500"
          >
            <Link
              href={
                item.mediaType === 'tv'
                  ? `/tv/${item.tmdbId}`
                  : `/movie/${item.tmdbId}`
              }
              className="absolute inset-0"
              onClick={(e) => {
                if (isTouch && canAdd && tappedKey !== key) {
                  e.preventDefault();
                  setTappedKey(key);
                }
              }}
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

            {/* A quiet stand-in for the status chip below, which only shows once the
                actions do: on hover for a mouse, on tap for touch. */}
            {item.status && (
              <div
                className={`pointer-events-none absolute bottom-1.5 right-1.5 z-30 transition-opacity duration-150 ${
                  canAdd && !isTouch ? 'group-hover:opacity-0' : ''
                } ${tapped ? 'opacity-0' : ''}`}
              >
                <WatchlistStatusDot status={item.status} />
              </div>
            )}

            {canAdd && (
              <div
                className={`pointer-events-none absolute inset-0 flex flex-col justify-between bg-gray-900 p-1.5 transition duration-150 ${
                  isTouch
                    ? tapped
                      ? 'bg-opacity-70 opacity-100'
                      : 'bg-opacity-0 opacity-0'
                    : 'bg-opacity-0 opacity-0 group-hover:bg-opacity-70 group-hover:opacity-100'
                }`}
              >
                <div className="pointer-events-auto flex justify-end gap-1">
                  <Button
                    buttonType="ghost"
                    buttonSize="sm"
                    onClick={() => onToggleSeen(item)}
                    title={intl.formatMessage(
                      item.watched ? messages.markunseen : messages.markseen
                    )}
                  >
                    <CheckIcon />
                  </Button>

                  <Button
                    buttonType="danger"
                    buttonSize="sm"
                    onClick={() => setRemoving(item)}
                    title={intl.formatMessage(messages.remove)}
                  >
                    <TrashIcon />
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
        );
      })}

      {previewItems.length === 0 && !canAdd && (
        <span className="self-center text-sm text-gray-500">
          {intl.formatMessage(messages.empty)}
        </span>
      )}

      <RemoveWatchlistItemModal
        show={!!removing}
        onConfirm={() => {
          if (removing) {
            onRemove(removing);
          }
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
};

export default WatchlistPosterStrip;
