import CachedImage from '@app/components/Common/CachedImage';
import RequestButton from '@app/components/RequestButton';
import type { MediaListItem } from '@app/domain/mediaLists/models/MediaListItem';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistItemCard', {
  movie: 'Movie',
  series: 'Series',
  seen: 'Seen',
  markseen: 'Mark seen',
  episodes: 'Episodes',
  episodeprogress: '{watched} / {total} episodes',
  seenbyothers:
    '{count, plural, one {# other member has seen this} other {# other members have seen this}}',
  untitled: 'Title unavailable',
  remove: 'Remove',
  removelabel: 'Remove {title} from this watchlist',
});

interface WatchlistItemCardProps {
  item: MediaListItem;
  canEdit: boolean;
  onToggleSeen: () => void;
  onOpenEpisodes: () => void;
  onRemove: () => void;
  onRequestUpdate: () => void;
}

const ProgressRing = ({
  watched,
  total,
}: {
  watched: number;
  total: number;
}) => {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(watched / total, 1) : 0;

  return (
    <div className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 bg-opacity-80">
      <svg viewBox="0 0 36 36" className="absolute h-10 w-10 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#818cf8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(fraction * circumference).toFixed(1)} ${circumference.toFixed(1)}`}
        />
      </svg>
      <span className="relative text-[10px] font-bold text-gray-200">
        {watched}/{total}
      </span>
    </div>
  );
};

const WatchlistItemCard = ({
  item,
  canEdit,
  onToggleSeen,
  onOpenEpisodes,
  onRemove,
  onRequestUpdate,
}: WatchlistItemCardProps) => {
  const intl = useIntl();

  const isSeries = !!item.progress;
  const title = item.title ?? intl.formatMessage(messages.untitled);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-gray-800 shadow ring-1 ring-gray-700">
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

        <div className="absolute left-2 top-2">
          <span
            className={`flex h-5 items-center rounded-full border px-2 text-[11px] font-medium uppercase tracking-wide text-white ${
              isSeries
                ? 'border-purple-600 bg-purple-600 bg-opacity-80'
                : 'border-blue-500 bg-blue-600 bg-opacity-80'
            }`}
          >
            {intl.formatMessage(isSeries ? messages.series : messages.movie)}
          </span>
        </div>

        {item.watched && (
          <>
            <div className="absolute inset-0 bg-gray-900 bg-opacity-60" />
            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-green-400 bg-green-500 bg-opacity-90 text-green-50">
              <CheckIcon className="h-4 w-4" />
            </div>
          </>
        )}

        {/* A started series shows how far along the viewer is, rather than a bare flag. */}
        {isSeries && !item.watched && !!item.progress?.totalEpisodes && (
          <ProgressRing
            watched={item.progress.watchedEpisodes}
            total={item.progress.totalEpisodes}
          />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent p-2.5 pt-8">
          {item.year && (
            <div className="text-[11px] text-gray-300">{item.year}</div>
          )}
          <div className="truncate text-sm font-bold text-white">{title}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {isSeries ? (
          <button
            type="button"
            onClick={onOpenEpisodes}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-600 bg-gray-800 bg-opacity-80 px-2 py-1.5 text-xs font-medium text-gray-200 transition duration-150 hover:bg-gray-700"
          >
            <ListBulletIcon className="h-4 w-4" />
            {intl.formatMessage(messages.episodes)}
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleSeen}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition duration-150 ${
              item.watched
                ? 'border-green-500 bg-green-500 bg-opacity-20 text-green-200 hover:bg-opacity-30'
                : 'border-gray-600 bg-gray-800 bg-opacity-80 text-gray-200 hover:bg-gray-700'
            }`}
          >
            {item.watched ? (
              <EyeIcon className="h-4 w-4" />
            ) : (
              <EyeSlashIcon className="h-4 w-4" />
            )}
            {intl.formatMessage(
              item.watched ? messages.seen : messages.markseen
            )}
          </button>
        )}

        {/* The existing request flow, reused as is. */}
        <RequestButton
          mediaType={item.mediaType === 'tv' ? 'tv' : 'movie'}
          tmdbId={item.tmdbId}
          onUpdate={onRequestUpdate}
        />
      </div>

      {isSeries && item.progress && item.progress.totalEpisodes > 0 && (
        <div className="text-[11px] text-gray-500">
          {intl.formatMessage(messages.episodeprogress, {
            watched: item.progress.watchedEpisodes,
            total: item.progress.totalEpisodes,
          })}
        </div>
      )}

      {item.seenBy.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <div className="flex items-center">
            {item.seenBy.slice(0, 3).map((user) => (
              <span
                key={user.id}
                title={user.displayName}
                className="-mr-1.5 flex h-[18px] w-[18px] items-center justify-center overflow-hidden rounded-full bg-gray-700 text-[9px] font-bold text-gray-200 ring-2 ring-gray-900"
              >
                {user.displayName.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
          <span className="ml-2">
            {intl.formatMessage(messages.seenbyothers, {
              count: item.seenBy.length,
            })}
          </span>
        </div>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={intl.formatMessage(messages.removelabel, { title })}
          className="self-start text-[11px] text-gray-600 transition duration-150 hover:text-red-400"
        >
          {intl.formatMessage(messages.remove)}
        </button>
      )}
    </div>
  );
};

export default WatchlistItemCard;
