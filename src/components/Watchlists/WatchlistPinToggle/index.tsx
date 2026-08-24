import defineMessages from '@app/utils/defineMessages';
import { BookmarkIcon as BookmarkOutlineIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistPinToggle', {
  pin: 'Pin',
  unpin: 'Unpin',
});

interface WatchlistPinToggleProps {
  pinned: boolean;
  // Whether the quiet unpinned state should currently be visible -- e.g. a touch tap,
  // or the card's own React-driven reveal state. Ignored once pinned, which always
  // shows: that is what lets a pinned title be spotted without revealing anything.
  revealed: boolean;
  // The poster strip reveals on a real CSS :hover (a `group` ancestor) rather than a
  // React state, since a mouse costs nothing to react to live. Adds `group-hover:` on
  // top of `revealed`, so either can bring the quiet outline up.
  revealOnGroupHover?: boolean;
  onToggle: () => void;
  // Grid card vs. poster strip tile, which run at different scales.
  size?: 'grid' | 'strip';
}

// One picto, and it is the toggle: filled and always visible once pinned, a quiet
// outline that only appears on reveal otherwise. Nothing else on the card repeats it.
const WatchlistPinToggle = ({
  pinned,
  revealed,
  revealOnGroupHover = false,
  onToggle,
  size = 'grid',
}: WatchlistPinToggleProps) => {
  const intl = useIntl();
  const dims = size === 'grid' ? 'h-5 w-5' : 'h-[17px] w-[17px]';
  const iconDims = size === 'grid' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  return (
    <button
      type="button"
      data-testid="watchlist-pin-toggle"
      onClick={(e) => {
        e.preventDefault();
        onToggle();
      }}
      aria-pressed={pinned}
      title={intl.formatMessage(pinned ? messages.unpin : messages.pin)}
      className={`pointer-events-auto z-40 flex flex-none items-center justify-center rounded-full border shadow-md transition duration-150 ${dims} ${
        pinned
          ? 'border-amber-400 bg-amber-500/90 text-amber-950'
          : `border-gray-500 bg-gray-900/60 text-gray-300 hover:border-white hover:text-white ${
              revealed ? 'opacity-100' : 'pointer-events-none opacity-0'
            } ${revealOnGroupHover ? 'group-hover:pointer-events-auto group-hover:opacity-100' : ''}`
      }`}
    >
      {pinned ? (
        <BookmarkSolidIcon className={iconDims} />
      ) : (
        <BookmarkOutlineIcon className={iconDims} />
      )}
    </button>
  );
};

export default WatchlistPinToggle;
