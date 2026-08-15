import CachedImage from '@app/components/Common/CachedImage';
import type {
  Collaborator,
  CollaboratorRole,
} from '@app/domain/mediaLists/models/Collaborator';
import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';
import defineMessages from '@app/utils/defineMessages';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.CollaboratorList', {
  peoplewithaccess: 'People with access',
  owner: 'Owner',
  canedit: 'Can edit',
  canview: 'Can view',
  remove: 'Remove {name}',
  nobody: 'This watchlist has not been shared with anyone yet.',
});

interface CollaboratorListProps {
  owner: MediaListUser;
  collaborators: Collaborator[];
  busyUserId: number | null;
  onChangeRole: (userId: number, role: CollaboratorRole) => void;
  onRemove: (userId: number) => void;
}

const Avatar = ({ user }: { user: MediaListUser }) => (
  <div className="relative h-9 w-9 flex-none overflow-hidden rounded-full bg-gray-600">
    {user.avatar && (
      <CachedImage
        type="avatar"
        src={user.avatar}
        alt=""
        fill
        className="object-cover"
      />
    )}
  </div>
);

const CollaboratorList = ({
  owner,
  collaborators,
  busyUserId,
  onChangeRole,
  onRemove,
}: CollaboratorListProps) => {
  const intl = useIntl();

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {intl.formatMessage(messages.peoplewithaccess)}
      </h3>

      <div className="mt-2 flex flex-col">
        {/* The owner is never a collaborator row, so they are listed separately and
            without controls. */}
        <div className="flex items-center gap-3 border-b border-gray-700 py-2.5">
          <Avatar user={owner} />
          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">
            {owner.displayName}
          </div>
          <span className="pr-2 text-sm text-gray-400">
            {intl.formatMessage(messages.owner)}
          </span>
        </div>

        {collaborators.map((collaborator) => (
          <div
            key={collaborator.user.id}
            className="flex items-center gap-3 border-b border-gray-700 py-2.5"
          >
            <Avatar user={collaborator.user} />
            <div className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">
              {collaborator.user.displayName}
            </div>

            <select
              value={collaborator.role}
              disabled={busyUserId === collaborator.user.id}
              onChange={(e) =>
                onChangeRole(
                  collaborator.user.id,
                  e.target.value as CollaboratorRole
                )
              }
              className="rounded-md border border-gray-500 bg-gray-700 py-1 pl-2 pr-8 text-sm text-gray-100 disabled:opacity-50"
            >
              <option value="read">
                {intl.formatMessage(messages.canview)}
              </option>
              <option value="write">
                {intl.formatMessage(messages.canedit)}
              </option>
            </select>

            <button
              type="button"
              disabled={busyUserId === collaborator.user.id}
              onClick={() => onRemove(collaborator.user.id)}
              aria-label={intl.formatMessage(messages.remove, {
                name: collaborator.user.displayName,
              })}
              className="rounded-md border border-gray-600 bg-gray-800 p-1.5 text-gray-400 transition duration-150 hover:text-white disabled:opacity-50"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ))}

        {collaborators.length === 0 && (
          <p className="py-3 text-sm text-gray-500">
            {intl.formatMessage(messages.nobody)}
          </p>
        )}
      </div>
    </div>
  );
};

export default CollaboratorList;
