import Button from '@app/components/Common/Button';
import WatchlistPosterStrip from '@app/components/Watchlists/WatchlistPosterStrip';
import WatchlistRoleBadge from '@app/components/Watchlists/WatchlistRoleBadge';
import WatchlistSharedWithAvatars from '@app/components/Watchlists/WatchlistSharedWithAvatars';
import type { MediaListSummary } from '@app/domain/mediaLists/models/MediaList';
import { canEditItems } from '@app/domain/mediaLists/models/MediaList';
import defineMessages from '@app/utils/defineMessages';
import {
  ChevronRightIcon,
  PencilIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistShelf', {
  titlecount: '{count, plural, one {# title} other {# titles}}',
  seencount: '{count} seen',
  edit: 'Edit {name}',
  share: 'Share {name}',
});

interface WatchlistShelfProps {
  list: MediaListSummary;
  onOpenOptions?: (list: MediaListSummary) => void;
  onAddMedia: (list: MediaListSummary) => void;
  // Only the owner may share, so the entry point is absent rather than disabled.
  onShare?: (list: MediaListSummary) => void;
}

const WatchlistShelf = ({
  list,
  onOpenOptions,
  onAddMedia,
  onShare,
}: WatchlistShelfProps) => {
  const intl = useIntl();
  const router = useRouter();
  const href = `/watchlists/${list.id}`;

  return (
    // The row itself opens the list -- everything inside that already has its own
    // destination (the poster strip's items and controls, the share/edit buttons, the
    // shared-with avatars' profile links) stops the click from bubbling here, so its
    // own click wins instead of also navigating to this list.
    <div
      data-testid="watchlist-shelf"
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          router.push(href);
        }
      }}
      className="flex cursor-pointer flex-col gap-4 rounded-lg border-t border-gray-700 px-2 py-4 transition-colors duration-150 hover:bg-gray-800/40 active:bg-gray-800/60 lg:flex-row lg:items-center lg:gap-5"
    >
      <div className="flex w-full flex-none flex-col gap-1.5 lg:w-[300px]">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={href}
            className="group flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-lg font-bold text-gray-100 transition duration-150 group-hover:text-white">
              {list.name}
            </span>
            <ChevronRightIcon className="h-5 w-5 text-gray-500" />
          </Link>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- a propagation guard, not a new interactive element; the buttons inside are already keyboard-accessible on their own. */}
          <div
            className="flex flex-none items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {onShare && (
              <Button
                buttonType="ghost"
                buttonSize="sm"
                onClick={() => onShare(list)}
                title={intl.formatMessage(messages.share, { name: list.name })}
              >
                <UserPlusIcon className="h-5 w-5" />
              </Button>
            )}

            {onOpenOptions && (
              <Button
                buttonType="ghost"
                buttonSize="sm"
                onClick={() => onOpenOptions(list)}
                title={intl.formatMessage(messages.edit, {
                  name: list.name,
                })}
              >
                <PencilIcon className="h-5 w-5" />
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
          <span>
            {intl.formatMessage(messages.seencount, {
              count: list.seenCount,
            })}
          </span>
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- a propagation guard; the avatar links inside are already keyboard-accessible on their own. */}
        <div
          className="mt-1 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <WatchlistRoleBadge role={list.role} />
          <WatchlistSharedWithAvatars
            sharedWith={list.sharedWith}
            sharedWithCount={list.sharedWithCount}
          />
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- a propagation guard; everything the strip renders is already its own keyboard-accessible link or button. */}
      <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
        <WatchlistPosterStrip
          listId={list.id}
          name={list.name}
          previewItems={list.previewItems}
          itemCount={list.itemCount}
          canAdd={canEditItems(list.role)}
          onAdd={() => onAddMedia(list)}
        />
      </div>
    </div>
  );
};

export default WatchlistShelf;
