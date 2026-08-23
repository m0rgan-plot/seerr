import { statusDotClass } from '@app/components/Watchlists/statusPresentation';
import type { MediaStatus } from '@server/constants/media';

// A quiet, always-on stand-in for the status chip: purely visual, since it disappears
// the moment a hover would reveal the chip, which is where the color legend lives.
const WatchlistStatusDot = ({ status }: { status: MediaStatus }) => {
  const dotClass = statusDotClass(status);

  if (!dotClass) {
    return null;
  }

  return (
    <span
      className={`block h-2.5 w-2.5 rounded-full ring-1 ring-black/40 ${dotClass}`}
    />
  );
};

export default WatchlistStatusDot;
