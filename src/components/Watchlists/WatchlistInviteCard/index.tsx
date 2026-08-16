import Spinner from '@app/assets/spinner.svg';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Tooltip from '@app/components/Common/Tooltip';
import type { WatchlistInvite } from '@app/domain/mediaLists/models/Invite';
import defineMessages from '@app/utils/defineMessages';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistInviteCard', {
  invitedby: '{name} invited you',
  itemcount: '{count, plural, one {# title} other {# titles}}',
  accept: 'Accept',
  reject: 'Reject',
});

interface WatchlistInviteCardProps {
  invite: WatchlistInvite;
  busy: 'accept' | 'reject' | null;
  onAccept: () => void;
  onReject: () => void;
}

// No poster, no titles: the point of a pending invite is to decide whether to join a
// list before its contents are visible, so the card only ever shows the list name, who
// invited you, and how many titles it holds.
const WatchlistInviteCard = ({
  invite,
  busy,
  onAccept,
  onReject,
}: WatchlistInviteCardProps) => {
  const intl = useIntl();

  return (
    <div
      className="relative flex w-72 flex-col overflow-hidden rounded-xl bg-gray-800 p-4 text-gray-400 shadow ring-1 ring-gray-700 sm:w-96"
      data-testid="watchlist-invite-card"
    >
      <div
        className="overflow-hidden overflow-ellipsis whitespace-nowrap text-base font-bold text-white sm:text-lg"
        data-testid="watchlist-invite-card-title"
      >
        {invite.listName}
      </div>

      {invite.invitedBy && (
        <div className="card-field mt-1">
          <span className="group flex items-center">
            <span className="avatar-sm">
              <CachedImage
                type="avatar"
                src={invite.invitedBy.avatar}
                alt=""
                className="avatar-sm object-cover"
                width={20}
                height={20}
              />
            </span>
            <span className="truncate">
              {intl.formatMessage(messages.invitedby, {
                name: invite.invitedBy.displayName,
              })}
            </span>
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center text-sm">
        <Badge badgeType="light">
          {intl.formatMessage(messages.itemcount, { count: invite.itemCount })}
        </Badge>
      </div>

      <div className="mt-4 flex flex-1 items-end space-x-2">
        <div>
          <Button
            buttonType="success"
            buttonSize="sm"
            className="hidden sm:block"
            onClick={onAccept}
            disabled={busy !== null}
          >
            {busy === 'accept' ? <Spinner /> : <CheckIcon />}
            <span>{intl.formatMessage(messages.accept)}</span>
          </Button>
          <Tooltip content={intl.formatMessage(messages.accept)}>
            <Button
              buttonType="success"
              buttonSize="sm"
              className="sm:hidden"
              onClick={onAccept}
              disabled={busy !== null}
            >
              {busy === 'accept' ? <Spinner /> : <CheckIcon />}
            </Button>
          </Tooltip>
        </div>
        <div>
          <Button
            buttonType="danger"
            buttonSize="sm"
            className="hidden sm:block"
            onClick={onReject}
            disabled={busy !== null}
          >
            {busy === 'reject' ? <Spinner /> : <XMarkIcon />}
            <span>{intl.formatMessage(messages.reject)}</span>
          </Button>
          <Tooltip content={intl.formatMessage(messages.reject)}>
            <Button
              buttonType="danger"
              buttonSize="sm"
              className="sm:hidden"
              onClick={onReject}
              disabled={busy !== null}
            >
              {busy === 'reject' ? <Spinner /> : <XMarkIcon />}
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default WatchlistInviteCard;
