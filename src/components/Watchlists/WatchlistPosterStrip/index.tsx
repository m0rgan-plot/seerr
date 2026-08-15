import CachedImage from '@app/components/Common/CachedImage';
import type { MediaListRef } from '@app/domain/mediaLists/models/MediaList';
import defineMessages from '@app/utils/defineMessages';
import { PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistPosterStrip', {
  add: 'Add',
  addtitles: 'Add titles to {name}',
  empty: 'Nothing on this list yet',
});

interface WatchlistPosterStripProps {
  listId: number;
  name: string;
  previewItems: MediaListRef[];
  // The add tile only appears for members who may actually change the list.
  canAdd: boolean;
}

const WatchlistPosterStrip = ({
  listId,
  name,
  previewItems,
  canAdd,
}: WatchlistPosterStripProps) => {
  const intl = useIntl();

  return (
    <div className="flex gap-3 overflow-hidden">
      {previewItems.map((item) => (
        <Link
          key={`${item.mediaType}-${item.tmdbId}`}
          href={`/watchlists/${listId}`}
          className="relative aspect-[2/3] w-[108px] flex-none overflow-hidden rounded-lg shadow ring-1 ring-gray-700 transition duration-150 hover:ring-gray-500"
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
      ))}

      {canAdd && (
        <Link
          href={`/watchlists/${listId}`}
          aria-label={intl.formatMessage(messages.addtitles, { name })}
          className="flex aspect-[2/3] w-[108px] flex-none flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 text-gray-500 transition duration-150 hover:border-gray-500 hover:text-gray-400"
        >
          <PlusIcon className="h-6 w-6" />
          <span className="text-xs">{intl.formatMessage(messages.add)}</span>
        </Link>
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
