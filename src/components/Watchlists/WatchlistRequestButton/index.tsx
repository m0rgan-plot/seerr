import Button from '@app/components/Common/Button';
import RequestModal from '@app/components/RequestModal';
import globalMessages from '@app/i18n/globalMessages';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { MediaStatus, MediaType } from '@server/constants/media';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

interface WatchlistRequestButtonProps {
  tmdbId: number;
  mediaType: MediaType;
  // Where the title stands in the library. Null when nothing has ever tracked it.
  status: MediaStatus | null;
  className?: string;
  onRequested?: () => void;
}

/**
 * The request affordance for a title on a watchlist.
 *
 * This is the app's RequestModal, reached the way TitleCard reaches it, rather than
 * RequestButton: that one needs a full Media entity with its requests to decide what to
 * offer, and a list carries a status and nothing more. Given only the status, it would
 * offer a request for everything, including titles already available.
 *
 * Renders nothing once the title is spoken for, which is what leaves room for the status
 * badge the caller places instead.
 */
const WatchlistRequestButton = ({
  tmdbId,
  mediaType,
  status,
  className,
  onRequested,
}: WatchlistRequestButtonProps) => {
  const intl = useIntl();
  const [showModal, setShowModal] = useState(false);
  // Held locally so the button answers the click before the list is refetched.
  const [currentStatus, setCurrentStatus] = useState(status);

  useEffect(() => setCurrentStatus(status), [status]);

  const requestable =
    !currentStatus ||
    currentStatus === MediaStatus.UNKNOWN ||
    currentStatus === MediaStatus.DELETED;

  return (
    <>
      <RequestModal
        tmdbId={tmdbId}
        show={showModal}
        type={mediaType === MediaType.TV ? 'tv' : 'movie'}
        onComplete={(newStatus) => {
          setCurrentStatus(newStatus);
          setShowModal(false);
          onRequested?.();
        }}
        onCancel={() => setShowModal(false)}
      />

      {requestable && (
        <Button
          buttonType="primary"
          buttonSize="sm"
          className={className}
          onClick={(e) => {
            e.preventDefault();
            setShowModal(true);
          }}
        >
          <ArrowDownTrayIcon />
          <span>{intl.formatMessage(globalMessages.request)}</span>
        </Button>
      )}
    </>
  );
};

export default WatchlistRequestButton;
