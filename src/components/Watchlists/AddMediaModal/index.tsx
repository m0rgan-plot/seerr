import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import useDebouncedState from '@app/hooks/useDebouncedState';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { MediaType } from '@server/constants/media';
import type { MovieResult, TvResult } from '@server/models/Search';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Watchlists.AddMediaModal', {
  title: 'Add media',
  searchplaceholder: 'Search for a movie or series',
  all: 'All',
  movies: 'Movies',
  series: 'Series',
  add: 'Add',
  added: 'Added',
  addedcount: '{count, plural, one {# title added} other {# titles added}}',
  noresults: 'No results',
  addfailed: 'Something went wrong adding that title.',
  alreadyonlist: 'That title is already on this watchlist.',
});

type SearchFilter = 'all' | 'movie' | 'tv';

interface AddMediaModalProps {
  show: boolean;
  mediaListId: number;
  onComplete: () => void;
  onCancel: () => void;
}

interface SearchResponse {
  results: (MovieResult | TvResult)[];
}

const AddMediaModal = ({
  show,
  mediaListId,
  onComplete,
  onCancel,
}: AddMediaModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { addItem } = useMediaListMutations(mediaListId);

  const [query, debouncedQuery, setQuery] = useDebouncedState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [added, setAdded] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  const { data } = useSWR<SearchResponse>(
    debouncedQuery.trim()
      ? `/api/v1/search?query=${encodeURIComponent(debouncedQuery.trim())}`
      : null
  );

  const results = (data?.results ?? []).filter(
    (result): result is MovieResult | TvResult =>
      (result.mediaType === 'movie' || result.mediaType === 'tv') &&
      (filter === 'all' || result.mediaType === filter)
  );

  const keyOf = (result: MovieResult | TvResult) =>
    `${result.mediaType}-${result.id}`;

  const onAdd = async (result: MovieResult | TvResult) => {
    const key = keyOf(result);
    setPending(key);
    try {
      await addItem({
        tmdbId: result.id,
        mediaType: result.mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE,
      });
      setAdded((current) => [...current, key]);
    } catch (e) {
      // A duplicate is a normal thing to hit while browsing, so it reads as a note
      // rather than a failure.
      const isDuplicate =
        (e as { response?: { status?: number } })?.response?.status === 409;
      addToast(
        intl.formatMessage(
          isDuplicate ? messages.alreadyonlist : messages.addfailed
        ),
        { appearance: isDuplicate ? 'info' : 'error', autoDismiss: true }
      );
    } finally {
      setPending(null);
    }
  };

  const filters: { value: SearchFilter; label: string }[] = [
    { value: 'all', label: intl.formatMessage(messages.all) },
    { value: 'movie', label: intl.formatMessage(messages.movies) },
    { value: 'tv', label: intl.formatMessage(messages.series) },
  ];

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
        okText={intl.formatMessage(globalMessages.close)}
        onOk={() => {
          setQuery('');
          setAdded([]);
          onComplete();
        }}
        onCancel={onCancel}
      >
        <div className="relative mt-2 flex items-center">
          <MagnifyingGlassIcon className="absolute left-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={intl.formatMessage(messages.searchplaceholder)}
            className="w-full rounded-md border border-gray-500 bg-gray-700 py-2 pl-10 pr-3 text-white placeholder-gray-400"
          />
        </div>

        <div className="mt-3 flex gap-2">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition duration-150 ${
                filter === option.value
                  ? 'border-indigo-500 bg-indigo-600 bg-opacity-80 text-white'
                  : 'border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {results.map((result) => {
            const key = keyOf(result);
            const isAdded = added.includes(key);
            const title =
              result.mediaType === 'tv'
                ? (result as TvResult).name
                : (result as MovieResult).title;

            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg bg-gray-900 p-2"
              >
                <div className="relative aspect-[2/3] w-10 flex-none overflow-hidden rounded bg-gray-800">
                  {result.posterPath && (
                    <CachedImage
                      type="tmdb"
                      src={`https://image.tmdb.org/t/p/w300_and_h450_face${result.posterPath}`}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-100">
                    {title}
                  </div>
                  <div className="text-xs text-gray-400">
                    {intl.formatMessage(
                      result.mediaType === 'tv'
                        ? messages.series
                        : messages.movies
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAdded || pending === key}
                  onClick={() => onAdd(result)}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition duration-150 disabled:opacity-70 ${
                    isAdded
                      ? 'border-green-500 bg-green-500 bg-opacity-20 text-green-200'
                      : 'border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700'
                  }`}
                >
                  {isAdded ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <PlusIcon className="h-4 w-4" />
                  )}
                  {intl.formatMessage(isAdded ? messages.added : messages.add)}
                </button>
              </div>
            );
          })}

          {debouncedQuery.trim() && results.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              {intl.formatMessage(messages.noresults)}
            </div>
          )}
        </div>

        {added.length > 0 && (
          <div className="mt-3 text-sm text-gray-400">
            {intl.formatMessage(messages.addedcount, { count: added.length })}
          </div>
        )}
      </Modal>
    </Transition>
  );
};

export default AddMediaModal;
