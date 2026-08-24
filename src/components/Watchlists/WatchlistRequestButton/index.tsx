import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import Tooltip from '@app/components/Common/Tooltip';
import RequestModal from '@app/components/RequestModal';
import {
  statusBadgeTypes,
  statusMessages,
} from '@app/components/Watchlists/statusPresentation';
import WatchlistStatusLegend from '@app/components/Watchlists/WatchlistStatusLegend';
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
  // Icon only, no label -- where the row doesn't have room for the full "Request" label
  // next to the other controls. A Tooltip stands in for the label there.
  hideLabel?: boolean;
  // Suppresses the already-assigned status pill entirely -- for the shelf's poster
  // strip, where a tile has no room for a labelled pill next to Remove and the corner
  // status dot already carries the same Tooltip legend. The item card grid keeps the
  // pill even with hideLabel, since its own corner dot has no tooltip to fall back on.
  hideStatusPill?: boolean;
}

/**
 * The request affordance for a title on a watchlist.
 *
 * This is the app's RequestModal, reached the way TitleCard reaches it, rather than
 * RequestButton: that one needs a full Media entity with its requests to decide what to
 * offer, and a list carries a status and nothing more. Given only the status, it would
 * offer a request for everything, including titles already available.
 *
 * Once a title is spoken for, a status pill takes over the button's spot instead.
 */
const WatchlistRequestButton = ({
  tmdbId,
  mediaType,
  status,
  className,
  onRequested,
  hideLabel = false,
  hideStatusPill = false,
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

      {requestable &&
        (hideLabel ? (
          <Tooltip content={intl.formatMessage(globalMessages.request)}>
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
            </Button>
          </Tooltip>
        ) : (
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
        ))}

      {/* The shelf strip relies on WatchlistStatusDot for this instead -- a tile has no
          room for a labelled pill next to Remove, and the dot already carries the same
          Tooltip legend. */}
      {!hideStatusPill && !requestable && currentStatus && (
        <Tooltip
          content={<WatchlistStatusLegend />}
          tooltipConfig={{ delayShow: 1000 }}
        >
          <button type="button" className={`inline-flex ${className ?? ''}`}>
            <Badge
              badgeType={statusBadgeTypes[currentStatus] ?? 'default'}
              className="!h-auto w-full items-center justify-center py-1"
            >
              {intl.formatMessage(
                statusMessages[currentStatus] ?? globalMessages.unavailable
              )}
            </Badge>
          </button>
        </Tooltip>
      )}
    </>
  );
};

export default WatchlistRequestButton;
