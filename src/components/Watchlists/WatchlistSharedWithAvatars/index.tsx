import Avatar from '@app/components/Watchlists/Avatar';
import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import Link from 'next/link';
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
// chip when the server held some back. Secondary to the role badge beside it. Each
// avatar links to that person's profile rather than opening the share modal, which
// stays reachable from its own button. The point is "who am I sharing this with", so
// the signed-in member's own face never appears here even though the server's count
// includes them when they are a collaborator, not owner.
const WatchlistSharedWithAvatars = ({
  sharedWith,
  sharedWithCount,
}: WatchlistSharedWithAvatarsProps) => {
  const intl = useIntl();
  const { user } = useUser();

  const others = sharedWith.filter((person) => person.id !== user?.id);
  const othersCount = sharedWith.some((person) => person.id === user?.id)
    ? sharedWithCount - 1
    : sharedWithCount;

  if (others.length === 0) {
    return null;
  }

  const overflow = othersCount - others.length;

  return (
    <div
      className="flex items-center"
      title={intl.formatMessage(messages.sharedwith, {
        names: others.map((person) => person.displayName).join(', '),
      })}
    >
      {others.map((person, index) => (
        <Link
          key={person.id}
          href={`/users/${person.id}`}
          title={person.displayName}
          className={`relative rounded-full transition hover:z-10 hover:ring-2 hover:ring-indigo-500 ${index > 0 ? '-ml-2' : ''}`}
        >
          <Avatar user={person} size="sm" className="ring-2 ring-gray-800" />
        </Link>
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
