import {
  STATUS_LEGEND_ORDER,
  statusDotClass,
  statusMessages,
} from '@app/components/Watchlists/statusPresentation';
import { useIntl } from 'react-intl';

// The full color key, shared between wherever a status color needs explaining.
const WatchlistStatusLegend = () => {
  const intl = useIntl();

  return (
    <ul className="flex flex-col gap-1">
      {STATUS_LEGEND_ORDER.map((legendStatus) => {
        const legendMessage = statusMessages[legendStatus];
        return (
          <li key={legendStatus} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 flex-none rounded-full ${statusDotClass(legendStatus)}`}
            />
            <span>
              {legendMessage ? intl.formatMessage(legendMessage) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default WatchlistStatusLegend;
