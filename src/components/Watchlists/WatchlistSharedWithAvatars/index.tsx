import Avatar from '@app/components/Watchlists/Avatar';
import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.Watchlists.WatchlistSharedWithAvatars',
  {
    more: '+{count}',
    sharedwith: 'Shared with {names}',
  }
);

interface WatchlistSharedWithAvatarsProps {
  // Already capped by the server; sharedWithCount is the true total, for the "+N" chip.
  sharedWith: MediaListUser[];
  sharedWithCount: number;
}

// A quiet "who's here" row for the shelf: small overlapping circles, plus an overflow
// chip when the server held some back. Secondary to the role badge beside it, so it
// stays small and un-clickable rather than opening the share modal itself.
const WatchlistSharedWithAvatars = ({
  sharedWith,
  sharedWithCount,
}: WatchlistSharedWithAvatarsProps) => {
  const intl = useIntl();

  if (sharedWith.length === 0) {
    return null;
  }

  const overflow = sharedWithCount - sharedWith.length;

  return (
    <div
      className="flex items-center"
      title={intl.formatMessage(messages.sharedwith, {
        names: sharedWith.map((user) => user.displayName).join(', '),
      })}
    >
      {sharedWith.map((user, index) => (
        <Avatar
          key={user.id}
          user={user}
          size="sm"
          className={`ring-2 ring-gray-800 ${index > 0 ? '-ml-2' : ''}`}
        />
      ))}
      {overflow > 0 && (
        <div className="relative -ml-2 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gray-700 text-[10px] font-semibold text-gray-300 ring-2 ring-gray-800">
          {intl.formatMessage(messages.more, { count: overflow })}
        </div>
      )}
    </div>
  );
};

export default WatchlistSharedWithAvatars;
