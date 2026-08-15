import type { MediaListRole } from '@app/domain/mediaLists/models/MediaList';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistRoleBadge', {
  owner: 'Owner',
  canedit: 'Can edit',
  canview: 'Can view',
});

const styles: Record<MediaListRole, string> = {
  owner: 'border-indigo-700 bg-indigo-800 bg-opacity-25 text-indigo-200',
  write: 'border-green-600 bg-green-600 bg-opacity-20 text-green-200',
  read: 'border-gray-600 bg-gray-600 bg-opacity-30 text-gray-300',
};

const WatchlistRoleBadge = ({ role }: { role: MediaListRole }) => {
  const intl = useIntl();

  const label = {
    owner: messages.owner,
    write: messages.canedit,
    read: messages.canview,
  }[role];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[role]}`}
    >
      {intl.formatMessage(label)}
    </span>
  );
};

export default WatchlistRoleBadge;
