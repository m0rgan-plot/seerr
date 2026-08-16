import Modal from '@app/components/Common/Modal';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.Watchlists.RemoveWatchlistItemModal',
  {
    title: 'Remove Title',
    remove: 'Remove',
    confirm: 'Remove {title} from this watchlist?',
    confirmgeneric: 'Remove this title from this watchlist?',
  }
);

interface RemoveWatchlistItemModalProps {
  show: boolean;
  // Absent on the poster strip, which only has tmdb ids and art to work with.
  title?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const RemoveWatchlistItemModal = ({
  show,
  title,
  onConfirm,
  onCancel,
}: RemoveWatchlistItemModalProps) => {
  const intl = useIntl();

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
        okText={intl.formatMessage(messages.remove)}
        okButtonType="danger"
        onOk={onConfirm}
        onCancel={onCancel}
      >
        <p>
          {title
            ? intl.formatMessage(messages.confirm, { title })
            : intl.formatMessage(messages.confirmgeneric)}
        </p>
      </Modal>
    </Transition>
  );
};

export default RemoveWatchlistItemModal;
