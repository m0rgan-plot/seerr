import Modal from '@app/components/Common/Modal';
import { UserSelector } from '@app/components/Selector';
import CollaboratorList from '@app/components/Watchlists/CollaboratorList';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import { useMediaListCollaborators } from '@app/domain/mediaLists/hooks/useMediaLists';
import type { CollaboratorRole } from '@app/domain/mediaLists/models/Collaborator';
import type { MediaList } from '@app/domain/mediaLists/models/MediaList';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.ShareWatchlistModal', {
  title: 'Share watchlist',
  invite: 'Invite',
  canview: 'Can view',
  canedit: 'Can edit',
  onlyownerdeletes:
    'Editors can add and remove titles. Only {owner} can delete this watchlist.',
  shared: 'Watchlist shared.',
  sharefailed: 'Something went wrong sharing the watchlist.',
  alreadyshared: 'That person already has access.',
  cannotshareowner: 'You cannot share a watchlist with its owner.',
  rolechanged: 'Access updated.',
  rolefailed: 'Something went wrong updating access.',
  removed: 'Access removed.',
  removefailed: 'Something went wrong removing access.',
});

interface ShareWatchlistModalProps {
  show: boolean;
  list: MediaList;
  onCancel: () => void;
}

const ShareWatchlistModal = ({
  show,
  list,
  onCancel,
}: ShareWatchlistModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();

  const { data: collaborators, revalidate } = useMediaListCollaborators(
    show ? list.id : undefined
  );
  const { share, changeCollaboratorRole, removeCollaborator } =
    useMediaListMutations(list.id);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [role, setRole] = useState<CollaboratorRole>('read');
  const [inviting, setInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const onInvite = async () => {
    if (!selectedUserId) {
      return;
    }

    setInviting(true);
    try {
      await share({ userId: selectedUserId, role });
      addToast(intl.formatMessage(messages.shared), {
        appearance: 'success',
        autoDismiss: true,
      });
      setSelectedUserId(null);
      revalidate();
    } catch (e) {
      // The server distinguishes these, and each one is worth saying plainly rather
      // than reporting a generic failure.
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      addToast(
        intl.formatMessage(
          status === 409
            ? messages.alreadyshared
            : status === 400
              ? messages.cannotshareowner
              : messages.sharefailed
        ),
        { appearance: status ? 'info' : 'error', autoDismiss: true }
      );
    } finally {
      setInviting(false);
    }
  };

  return (
    <Transition
      as="div"
      enter="transition duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      <Modal
        title={intl.formatMessage(messages.title)}
        subTitle={list.name}
        okText={intl.formatMessage(globalMessages.close)}
        onOk={onCancel}
        onCancel={onCancel}
      >
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <UserSelector
              isMulti={false}
              onChange={(value) =>
                setSelectedUserId(
                  value ? Number((value as { value: number }).value) : null
                )
              }
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CollaboratorRole)}
            className="rounded-md border border-gray-500 bg-gray-700 py-2 pl-3 pr-8 text-sm text-gray-100"
          >
            <option value="read">{intl.formatMessage(messages.canview)}</option>
            <option value="write">
              {intl.formatMessage(messages.canedit)}
            </option>
          </select>

          <button
            type="button"
            disabled={!selectedUserId || inviting}
            onClick={onInvite}
            className="rounded-md border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition duration-150 hover:bg-indigo-500 disabled:opacity-50"
          >
            {intl.formatMessage(messages.invite)}
          </button>
        </div>

        <div className="mt-5">
          <CollaboratorList
            owner={list.owner}
            collaborators={collaborators ?? []}
            busyUserId={busyUserId}
            onChangeRole={async (userId, nextRole) => {
              setBusyUserId(userId);
              try {
                await changeCollaboratorRole(userId, nextRole);
                addToast(intl.formatMessage(messages.rolechanged), {
                  appearance: 'success',
                  autoDismiss: true,
                });
                revalidate();
              } catch {
                addToast(intl.formatMessage(messages.rolefailed), {
                  appearance: 'error',
                  autoDismiss: true,
                });
              } finally {
                setBusyUserId(null);
              }
            }}
            onRemove={async (userId) => {
              setBusyUserId(userId);
              try {
                await removeCollaborator(userId);
                addToast(intl.formatMessage(messages.removed), {
                  appearance: 'success',
                  autoDismiss: true,
                });
                revalidate();
              } catch {
                addToast(intl.formatMessage(messages.removefailed), {
                  appearance: 'error',
                  autoDismiss: true,
                });
              } finally {
                setBusyUserId(null);
              }
            }}
          />
        </div>

        <div className="mt-4 flex gap-2 rounded-lg bg-gray-900 p-3 ring-1 ring-gray-700">
          <InformationCircleIcon className="h-5 w-5 flex-none text-gray-400" />
          <p className="text-xs leading-relaxed text-gray-400">
            {intl.formatMessage(messages.onlyownerdeletes, {
              owner: list.owner.displayName,
            })}
          </p>
        </div>
      </Modal>
    </Transition>
  );
};

export default ShareWatchlistModal;
