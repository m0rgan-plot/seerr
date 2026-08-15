import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import { PlusIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistsEmptyState', {
  title: 'No watchlists yet',
  description:
    'Group the things you mean to watch, mark off what you have seen, and share a list with other users so you can build it together.',
  create: 'Create a watchlist',
});

const WatchlistsEmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const intl = useIntl();

  return (
    <div className="mt-16 flex flex-col items-center gap-4 text-center">
      <div className="h-18 w-18 flex items-center justify-center rounded-2xl bg-gray-800 p-4 text-gray-500 ring-1 ring-gray-700">
        <RectangleStackIcon className="h-9 w-9" />
      </div>
      <h3 className="text-xl font-bold text-gray-200">
        {intl.formatMessage(messages.title)}
      </h3>
      <p className="max-w-md text-sm leading-relaxed text-gray-400">
        {intl.formatMessage(messages.description)}
      </p>
      <Button buttonType="primary" onClick={onCreate} className="mt-2">
        <PlusIcon />
        <span>{intl.formatMessage(messages.create)}</span>
      </Button>
    </div>
  );
};

export default WatchlistsEmptyState;
