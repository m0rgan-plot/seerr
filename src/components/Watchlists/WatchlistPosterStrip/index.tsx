import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Tooltip from '@app/components/Common/Tooltip';
import RemoveWatchlistItemModal from '@app/components/Watchlists/RemoveWatchlistItemModal';
import WatchlistPinToggle from '@app/components/Watchlists/WatchlistPinToggle';
import WatchlistRequestButton from '@app/components/Watchlists/WatchlistRequestButton';
import WatchlistStatusDot from '@app/components/Watchlists/WatchlistStatusDot';
import WatchlistStatusLegend from '@app/components/Watchlists/WatchlistStatusLegend';
import { statusDotClass } from '@app/components/Watchlists/statusPresentation';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import type { MediaListRef } from '@app/domain/mediaLists/models/MediaList';
import useClickOutside from '@app/hooks/useClickOutside';
import { useIsTouch } from '@app/hooks/useIsTouch';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistPosterStrip', {
  add: 'Add',
  addtitles: 'Add titles to {name}',
  viewall: 'View All',
  viewalllist: 'View all of {name}',
  untitled: 'Title Unavailable',
  empty: 'Nothing on this list yet.',
  markseen: 'Mark Seen',
  markunseen: 'Mark Unseen',
  remove: 'Remove',
  removed: 'Removed from the watchlist.',
  removefailed: 'Something went wrong removing that title.',
  seenfailed: 'Something went wrong updating your watched state.',
  pinfailed: 'Something went wrong updating that pin.',
});

interface WatchlistPosterStripProps {
  listId: number;
  name: string;
  previewItems: MediaListRef[];
  // How many titles the list actually holds -- previewItems is capped, so this is what
  // tells the strip whether there is more to see than what it is showing.
  itemCount: number;
  // The add tile and hover CTAs only appear for members who may actually change the list.
  canAdd: boolean;
  onAdd: () => void;
}

const WatchlistPosterStrip = ({
  listId,
  name,
  previewItems,
  itemCount,
  canAdd,
  onAdd,
}: WatchlistPosterStripProps) => {
  const intl = useIntl();
  const isTouch = useIsTouch();
  const { addToast } = useToasts();
  const { setMovieWatched, setPinned, removeItem } =
    useMediaListMutations(listId);
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

  const onTogglePinned = async (item: MediaListRef) => {
    try {
      await setPinned(item.id, item.pinnedAt === null);
    } catch {
      addToast(intl.formatMessage(messages.pinfailed), {
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
        // item.status can be UNKNOWN/DELETED, which WatchlistStatusDot deliberately
        // renders as nothing -- checking the dot's own color mapping (rather than just
        // truthiness of item.status) keeps the corner reserved only when there is
        // actually a dot to reserve it for.
        const hasStatusDot = !!(item.status && statusDotClass(item.status));

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
                // A second tap costs a read-only viewer a real navigation, so touch
                // only reveals when there is something to reveal beyond the info row
                // hover shows for free. canAdd gates that the same way it always has.
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
                  className={`object-cover transition-opacity duration-300 ${
                    item.watched ? 'opacity-40' : ''
                  }`}
                />
              ) : (
                <div className="h-full w-full bg-gray-800" />
              )}
            </Link>

            <div className="absolute left-1.5 right-1.5 top-1.5 z-30 flex items-start justify-between">
              {canAdd ? (
                <WatchlistPinToggle
                  pinned={item.pinnedAt !== null}
                  onToggle={() => onTogglePinned(item)}
                  size="strip"
                />
              ) : (
                <span />
              )}

              {/* A series has no single-tap toggle (it tracks per episode via the
                  detail page's episode tracker), so completion stays a quiet,
                  non-interactive readout here, exactly as before. A movie's watched
                  picto doubles as its own toggle, the same way the pin picto does. */}
              {item.mediaType === 'tv' ? (
                item.watched && (
                  <div
                    data-testid="watchlist-strip-item-seen"
                    className="pointer-events-none flex h-5 w-5 flex-none items-center justify-center rounded-full border border-green-400 bg-green-500/90 text-green-50 shadow-md"
                  >
                    <CheckIcon className="h-3 w-3" />
                  </div>
                )
              ) : (
                <button
                  type="button"
                  data-testid="watchlist-strip-item-seen-toggle"
                  aria-pressed={item.watched}
                  onClick={() => onToggleSeen(item)}
                  title={intl.formatMessage(
                    item.watched ? messages.markunseen : messages.markseen
                  )}
                  className={`pointer-events-auto flex h-5 w-5 flex-none items-center justify-center rounded-full border shadow-md transition duration-150 ${
                    item.watched
                      ? 'border-green-400 bg-green-500/90 text-green-50 hover:border-green-300 hover:bg-green-400'
                      : `border-gray-500 bg-gray-900/60 text-gray-300 hover:border-white hover:text-white ${
                          tapped ? 'opacity-100' : 'opacity-0'
                        } ${!isTouch ? 'group-hover:opacity-100' : ''}`
                  }`}
                >
                  <CheckIcon className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* A quiet stand-in for the (now detail-page-only) status pill. Its own
                Tooltip (rather than a plain title) is what makes the legend reachable,
                so it has to stay visible and in place through hover for the tooltip to
                make any sense. It keeps its own fixed corner rather than fading or
                moving out of the way of the Remove/Request row (the canAdd case that
                row is gated on) -- that row leaves this corner clear instead, via its
                own pr-5. */}
            {hasStatusDot && item.status && (
              <div className="pointer-events-auto absolute bottom-1.5 right-1.5 z-30">
                <Tooltip
                  content={<WatchlistStatusLegend />}
                  // followCursor is the Tooltip default, meant for elements large
                  // enough for the cursor to roam across. This dot is fixed and tiny,
                  // and cursor-tracking here was the likely cause of the tooltip
                  // occasionally sticking open after the mouse had actually left.
                  tooltipConfig={{ delayShow: 1000, followCursor: false }}
                >
                  <span className="inline-flex">
                    <WatchlistStatusDot status={item.status} />
                  </span>
                </Tooltip>
              </div>
            )}

            {/* Unconditional now: a mouse hover costs nothing, so everyone gets the
                title/year row even on a read-only list. Touch is different -- a tap
                there is a real navigation, so it still only reveals when there are edit
                actions worth the extra tap (canAdd, via `tapped`, which can only be set
                when canAdd is true -- see the Link's onClick above). The poster is too
                small here for the added-date/by-whom line that used to live in this
                spot; that only shows on the detail page's larger cards now. */}
            <div
              className={`pointer-events-none absolute inset-0 flex flex-col justify-between bg-gray-900 p-1.5 transition duration-150 ${
                isTouch
                  ? tapped
                    ? 'bg-opacity-70 opacity-100'
                    : 'bg-opacity-0 opacity-0'
                  : 'bg-opacity-0 opacity-0 group-hover:bg-opacity-70 group-hover:opacity-100'
              }`}
            >
              {/* mt-5 clears the pin/watched chip row, which sits in its own
                  always-mounted overlay at the same top-left corner. Same
                  year-then-title treatment as every other poster hover overlay in the
                  app (TitleCard, the detail grid card), just for a smaller tile. */}
              <div className="mt-5 min-w-0 text-white">
                {item.year && (
                  <div className="text-sm font-medium">{item.year}</div>
                )}
                <div
                  className="whitespace-normal text-lg font-bold leading-tight"
                  style={{
                    WebkitLineClamp: 2,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-word',
                  }}
                  title={item.title ?? intl.formatMessage(messages.untitled)}
                >
                  {item.title ?? intl.formatMessage(messages.untitled)}
                </div>
              </div>

              {canAdd && (
                // pr-5 leaves the status dot's fixed bottom-right corner clear rather
                // than letting the request button (flex-1) run underneath it -- only
                // when there is a dot there to clear; otherwise the row uses the width.
                <div
                  className={`pointer-events-auto flex gap-2 ${hasStatusDot ? 'pr-5' : ''}`}
                >
                  <Button
                    buttonType="danger"
                    buttonSize="sm"
                    className="flex-1"
                    onClick={() => setRemoving(item)}
                    title={intl.formatMessage(messages.remove)}
                  >
                    <TrashIcon />
                  </Button>
                  <WatchlistRequestButton
                    tmdbId={item.tmdbId}
                    mediaType={item.mediaType}
                    status={item.status}
                    className="flex-1"
                    hideLabel
                    hideStatusPill
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {previewItems.length === 0 && !canAdd && (
        <span className="self-center text-sm text-gray-500">
          {intl.formatMessage(messages.empty)}
        </span>
      )}

      {itemCount > previewItems.length && (
        // Preview is capped (see PREVIEW_ITEM_COUNT server-side), so once a list
        // outgrows it this is the only visible cue that there is more than what is
        // shown here -- the row-level click on WatchlistShelf already goes to the same
        // place, but nothing inside the strip itself hinted at that before this tile.
        <Link
          href={`/watchlists/${listId}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={intl.formatMessage(messages.viewalllist, { name })}
          className="flex aspect-[2/3] w-[108px] flex-none flex-col items-center justify-center gap-1 rounded-lg border border-gray-700 text-gray-400 transition duration-150 hover:border-gray-500 hover:text-gray-300"
        >
          <ChevronRightIcon className="h-6 w-6" />
          <span className="text-xs">
            {intl.formatMessage(messages.viewall)}
          </span>
        </Link>
      )}

      <RemoveWatchlistItemModal
        show={!!removing}
        title={removing?.title ?? undefined}
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
