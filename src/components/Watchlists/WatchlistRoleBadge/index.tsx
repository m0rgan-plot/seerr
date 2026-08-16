import Badge from '@app/components/Common/Badge';
import type { MediaListRole } from '@app/domain/mediaLists/models/MediaList';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistRoleBadge', {
  owner: 'Owner',
  canedit: 'Can Edit',
  canview: 'Can View',
});

// Owner and editor are the roles that change what the page offers, so they carry the
// colours the rest of the app uses for that, and read-only stays neutral.
const badges: Record<
  MediaListRole,
  { type: 'primary' | 'success' | 'light'; label: keyof typeof messages }
> = {
  owner: { type: 'primary', label: 'owner' },
  write: { type: 'success', label: 'canedit' },
  read: { type: 'light', label: 'canview' },
};

const WatchlistRoleBadge = ({ role }: { role: MediaListRole }) => {
  const intl = useIntl();
  const badge = badges[role];

  return (
    <Badge badgeType={badge.type}>
      {intl.formatMessage(messages[badge.label])}
    </Badge>
  );
};

export default WatchlistRoleBadge;
