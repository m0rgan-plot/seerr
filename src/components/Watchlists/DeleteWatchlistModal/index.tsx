import Modal from '@app/components/Common/Modal';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import type { MediaList } from '@app/domain/mediaLists/models/MediaList';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.DeleteWatchlistModal', {
  title: 'Delete Watchlist',
  confirm: 'Are you sure you want to delete {name}? This cannot be undone.',
  sharednote:
    'Anyone it was shared with loses access, and their watched history for it goes too.',
  success: 'Watchlist deleted.',
  failed: 'Something went wrong deleting the watchlist.',
});

interface DeleteWatchlistModalProps {
  show: boolean;
  list?: MediaList;
  onComplete: () => void;
  onCancel: () => void;
}

const DeleteWatchlistModal = ({
  show,
  list,
  onComplete,
  onCancel,
}: DeleteWatchlistModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { deleteList } = useMediaListMutations();

  return (
    <Transition
      as="div"
      enter="transition duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show && !!list}
    >
      <Modal
        title={intl.formatMessage(messages.title)}
        okText={intl.formatMessage(globalMessages.delete)}
        okButtonType="danger"
        onOk={async () => {
          if (!list) {
            return;
          }
          try {
            await deleteList(list.id);
            addToast(intl.formatMessage(messages.success), {
              appearance: 'success',
              autoDismiss: true,
            });
            onComplete();
          } catch {
            addToast(intl.formatMessage(messages.failed), {
              appearance: 'error',
              autoDismiss: true,
            });
          }
        }}
        onCancel={onCancel}
      >
        <p>
          {intl.formatMessage(messages.confirm, { name: list?.name ?? '' })}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {intl.formatMessage(messages.sharednote)}
        </p>
      </Modal>
    </Transition>
  );
};

export default DeleteWatchlistModal;
