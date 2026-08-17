import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import RemoveWatchlistItemModal from '@app/components/Watchlists/RemoveWatchlistItemModal';
import WatchlistRequestButton from '@app/components/Watchlists/WatchlistRequestButton';
import WatchlistStatusDot from '@app/components/Watchlists/WatchlistStatusDot';
import type { MediaListItem } from '@app/domain/mediaLists/models/MediaListItem';
import { isSeries } from '@app/domain/mediaLists/models/MediaListItem';
import { useIsTouch } from '@app/hooks/useIsTouch';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  CheckIcon,
  ListBulletIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistItemCard', {
  markseen: 'Mark Seen',
  markunseen: 'Mark Unseen',
  episodes: 'Episodes',
  episodeprogress: '{watched} / {total} episodes',
  seenbyothers:
    '{count, plural, one {# other member has seen this} other {# other members have seen this}}',
  untitled: 'Title Unavailable',
  remove: 'Remove',
  removelabel: 'Remove {title} from this watchlist',
});

interface WatchlistItemCardProps {
  item: MediaListItem;
  canEdit: boolean;
  episodesOpen: boolean;
  onToggleSeen: () => void;
  onOpenEpisodes: () => void;
  onRemove: () => void;
  onRequestUpdate: () => void;
}

const WatchlistItemCard = ({
  item,
  canEdit,
  episodesOpen,
  onToggleSeen,
  onOpenEpisodes,
  onRemove,
  onRequestUpdate,
}: WatchlistItemCardProps) => {
  const intl = useIntl();
  const isTouch = useIsTouch();

  const [showDetail, setShowDetail] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const series = isSeries(item);
  const title = item.title ?? intl.formatMessage(messages.untitled);
  const href = series ? `/tv/${item.tmdbId}` : `/movie/${item.tmdbId}`;

  const progressPercent =
    item.progress && item.progress.totalEpisodes > 0
      ? Math.round(
          (item.progress.watchedEpisodes / item.progress.totalEpisodes) * 100
        )
      : 0;

  return (
    // The tmdb id is on the card so a test, or anything else looking for one title,
    // can find it without depending on artwork or on the name TMDB returns today.
    <div data-testid="watchlist-item" data-tmdb-id={item.tmdbId}>
      <div
        data-testid="watchlist-item-poster"
        className={`relative w-full transform-gpu cursor-default overflow-hidden rounded-xl bg-gray-800 bg-cover outline-none ring-1 transition duration-300 ${
          showDetail
            ? 'scale-105 shadow-lg ring-gray-500'
            : 'scale-100 shadow ring-gray-700'
        }`}
        style={{ paddingBottom: '150%' }}
        onMouseEnter={() => {
          if (!isTouch) {
            setShowDetail(true);
          }
        }}
        onMouseLeave={() => setShowDetail(false)}
        onClick={() => setShowDetail(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setShowDetail(true);
          }
        }}
        role="link"
        tabIndex={0}
      >
        <div className="absolute inset-0 h-full w-full overflow-hidden">
          <CachedImage
            type="tmdb"
            className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
              item.watched ? 'opacity-40' : ''
            }`}
            alt=""
            src={
              item.posterPath
                ? `https://image.tmdb.org/t/p/w300_and_h450_face${item.posterPath}`
                : '/images/seerr_poster_not_found_logo_top.png'
            }
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />

          <div className="absolute left-0 right-0 flex items-start justify-between p-2">
            <div
              className={`pointer-events-none z-40 rounded-full border shadow-md ${
                series
                  ? 'border-purple-600 bg-purple-600/80'
                  : 'border-blue-500 bg-blue-600/80'
              }`}
            >
              <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white sm:h-5">
                {intl.formatMessage(
                  series ? globalMessages.tvshow : globalMessages.movie
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              {/* Watched is the member's own state, so it stays visible rather than
                  waiting for a hover the way the actions do. */}
              {item.watched && (
                <div
                  data-testid="watchlist-item-seen"
                  className="pointer-events-none z-40 flex h-5 w-5 items-center justify-center rounded-full border border-green-400 bg-green-500/90 text-green-50 shadow-md"
                >
                  <CheckIcon className="h-3 w-3" />
                </div>
              )}
              {/* The list actions sit here, where a title card keeps its own secondary
                  actions, because the foot of the card is only wide enough for one. */}
              {showDetail && (
                <div className="z-40 flex flex-col gap-1">
                  <Button
                    data-testid="watchlist-item-seen-toggle"
                    buttonType="ghost"
                    buttonSize="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleSeen();
                    }}
                    title={intl.formatMessage(
                      item.watched ? messages.markunseen : messages.markseen
                    )}
                  >
                    <CheckIcon className="h-3" />
                  </Button>

                  {canEdit && (
                    <Button
                      data-testid="watchlist-item-remove"
                      buttonType="ghost"
                      buttonSize="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmingRemove(true);
                      }}
                      title={intl.formatMessage(messages.removelabel, {
                        title,
                      })}
                    >
                      <TrashIcon className="h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* A started series reads as a bar along the foot of the poster, which survives
              the card being this much smaller. */}
          {series && !item.watched && progressPercent > 0 && (
            <div className="absolute inset-x-0 bottom-0 z-30 h-1 bg-gray-900/60">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* A quiet stand-in for the status chip, which only shows on hover: gone the
              moment the chip takes over so the two are never on screen together. */}
          {item.status && (
            <div
              className={`absolute bottom-2 right-2 z-30 transition-opacity duration-150 ${
                showDetail ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <WatchlistStatusDot status={item.status} />
            </div>
          )}

          <Transition
            as={Fragment}
            show={!item.posterPath || showDetail}
            enter="transition-opacity"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              <Link
                href={href}
                className="absolute inset-0 h-full w-full cursor-pointer overflow-hidden text-left"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(45, 55, 72, 0.4) 0%, rgba(45, 55, 72, 0.9) 100%)',
                }}
              >
                <div className="flex h-full w-full items-end">
                  <div className="px-2 pb-11 text-white">
                    {item.year && (
                      <div className="text-sm font-medium">{item.year}</div>
                    )}
                    <h2
                      className="whitespace-normal text-lg font-bold leading-tight"
                      style={{
                        WebkitLineClamp: 3,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                      }}
                      data-testid="watchlist-item-title"
                    >
                      {title}
                    </h2>
                    {series && item.progress?.totalEpisodes ? (
                      <div className="mt-1 text-xs text-gray-300">
                        {intl.formatMessage(messages.episodeprogress, {
                          watched: item.progress.watchedEpisodes,
                          total: item.progress.totalEpisodes,
                        })}
                      </div>
                    ) : null}
                    {item.seenBy.length > 0 && (
                      <div className="mt-1 text-xs text-gray-300">
                        {intl.formatMessage(messages.seenbyothers, {
                          count: item.seenBy.length,
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Link>

              {/* The primary action alone across the foot: at this card width a row of
                  four would clip the request label, which is the one that matters. */}
              <div className="absolute bottom-0 left-0 right-0 flex gap-1 px-2 py-2">
                {series && (
                  <Button
                    data-testid="watchlist-item-episodes"
                    buttonType={episodesOpen ? 'primary' : 'default'}
                    buttonSize="sm"
                    className="h-7"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenEpisodes();
                    }}
                    title={intl.formatMessage(messages.episodes)}
                  >
                    <ListBulletIcon />
                  </Button>
                )}

                <WatchlistRequestButton
                  tmdbId={item.tmdbId}
                  mediaType={item.mediaType}
                  status={item.status}
                  className="h-7 flex-1"
                  onRequested={onRequestUpdate}
                />
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <RemoveWatchlistItemModal
        show={confirmingRemove}
        title={title}
        onConfirm={() => {
          setConfirmingRemove(false);
          onRemove();
        }}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
};

export default WatchlistItemCard;
