import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistPinToggle', {
  pin: 'Pin',
  unpin: 'Unpin',
});

// A pushpin rather than a Heroicons glyph -- Heroicons has no thumbtack, and this is
// the one shape used for both the pinned and unpinned state, told apart by color and
// fill only (there is no separate outline artwork for this glyph).
const PinIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 489.493 489.493"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M485.322,117.705c12.204-12.238-3.274-47.577-34.636-78.93c-30.99-30.99-65.76-46.396-78.401-34.941l-0.246-0.236
	l-173.715,156.02c-32.117-27.993-80.684-27.038-111.278,3.534c-5.149,5.157-8.051,12.146-8.051,19.437
	c0,7.292,2.901,14.283,8.051,19.431l78.808,78.801L3.902,463.627c-5.148,5.799-5.262,14.655,0.015,20.601
	c5.689,6.403,15.497,6.992,21.916,1.294l182.575-162.137l7.84,7.829l40.601,40.603l0,0l30.336,30.329
	c5.15,5.147,12.139,8.039,19.424,8.039c7.278,0,14.272-2.898,19.419-8.056c30.561-30.573,31.524-79.158,3.539-111.27L484.771,118.03
	C484.927,117.892,485.177,117.861,485.322,117.705z"
    />
  </svg>
);

interface WatchlistPinToggleProps {
  pinned: boolean;
  onToggle: () => void;
  // Grid card vs. poster strip tile, which run at different scales.
  size?: 'grid' | 'strip';
}

// One picto, and it is the toggle: filled amber once pinned, a quiet gray outline
// otherwise. Always visible -- unlike watched, a pin is something to notice and reach
// for even before hovering or tapping the card. Nothing else on the card repeats it.
const WatchlistPinToggle = ({
  pinned,
  onToggle,
  size = 'grid',
}: WatchlistPinToggleProps) => {
  const intl = useIntl();
  const dims = size === 'grid' ? 'h-6 w-6' : 'h-5 w-5';
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
          ? 'border-amber-400 bg-amber-500/90 text-amber-950 hover:border-amber-300 hover:bg-amber-400'
          : 'border-gray-500 bg-gray-900/60 text-gray-300 hover:border-white hover:text-white'
      }`}
    >
      <PinIcon className={iconDims} />
    </button>
  );
};

export default WatchlistPinToggle;
