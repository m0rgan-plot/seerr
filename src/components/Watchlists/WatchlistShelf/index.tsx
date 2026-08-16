import Button from '@app/components/Common/Button';
import WatchlistPosterStrip from '@app/components/Watchlists/WatchlistPosterStrip';
import WatchlistRoleBadge from '@app/components/Watchlists/WatchlistRoleBadge';
import type { MediaListSummary } from '@app/domain/mediaLists/models/MediaList';
import { canEditItems } from '@app/domain/mediaLists/models/MediaList';
import defineMessages from '@app/utils/defineMessages';
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistShelf', {
  titlecount: '{count, plural, one {# title} other {# titles}}',
  seencount: '{count} seen',
  byowner: 'by {name}',
  options: 'Options for {name}',
  share: 'Share {name}',
});

interface WatchlistShelfProps {
  list: MediaListSummary;
  // Shown on lists someone else shared, where the owner is the useful detail.
  showOwner?: boolean;
  onOpenOptions?: (list: MediaListSummary) => void;
  onAddMedia: (list: MediaListSummary) => void;
  // Only the owner may share, so the entry point is absent rather than disabled.
  onShare?: (list: MediaListSummary) => void;
}

const WatchlistShelf = ({
  list,
  showOwner = false,
  onOpenOptions,
  onAddMedia,
  onShare,
}: WatchlistShelfProps) => {
  const intl = useIntl();

  return (
    <div
      data-testid="watchlist-shelf"
      className="flex flex-col gap-4 border-t border-gray-700 py-4 lg:flex-row lg:items-center lg:gap-5"
    >
      <div className="flex w-full flex-none flex-col gap-1.5 lg:w-[300px]">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/watchlists/${list.id}`}
            className="group flex items-center gap-2"
          >
            <span className="text-lg font-bold text-gray-100 transition duration-150 group-hover:text-white">
              {list.name}
            </span>
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          </Link>

          <div className="flex flex-none items-center gap-1">
            {onShare && (
              <Button
                buttonType="ghost"
                buttonSize="sm"
                onClick={() => onShare(list)}
                title={intl.formatMessage(messages.share, { name: list.name })}
              >
                <UserPlusIcon />
              </Button>
            )}

            {onOpenOptions && (
              <Button
                buttonType="ghost"
                buttonSize="sm"
                onClick={() => onOpenOptions(list)}
                title={intl.formatMessage(messages.options, {
                  name: list.name,
                })}
              >
                <EllipsisVerticalIcon />
              </Button>
            )}
          </div>
        </div>

        {list.description && (
          <p className="text-sm leading-snug text-gray-400">
            {list.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
          <span>
            {intl.formatMessage(messages.titlecount, { count: list.itemCount })}
          </span>
          <span className="text-gray-600">&middot;</span>
          {showOwner ? (
            <span>
              {intl.formatMessage(messages.byowner, {
                name: list.owner.displayName,
              })}
            </span>
          ) : (
            <span>
              {intl.formatMessage(messages.seencount, {
                count: list.seenCount,
              })}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <WatchlistRoleBadge role={list.role} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <WatchlistPosterStrip
          listId={list.id}
          name={list.name}
          previewItems={list.previewItems}
          canAdd={canEditItems(list.role)}
          onAdd={() => onAddMedia(list)}
        />
      </div>
    </div>
  );
};

export default WatchlistShelf;
