import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import { useMediaListItems } from '@app/domain/mediaLists/hooks/useMediaLists';
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
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Watchlists.AddMediaModal', {
  title: 'Add Media',
  searchlabel: 'Search Movies & Series',
  add: 'Add',
  added: 'Added',
  addedcount: '{count, plural, one {# title added} other {# titles added}}',
  addfailed: 'Something went wrong adding that title.',
  alreadyonlist: 'That title is already on this watchlist.',
});

type SearchFilter = 'all' | 'movie' | 'tv';

interface AddMediaModalProps {
  show: boolean;
  mediaListId: number;
  mediaListName: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface SearchResponse {
  results: (MovieResult | TvResult)[];
}

const AddMediaModal = ({
  show,
  mediaListId,
  mediaListName,
  onComplete,
  onCancel,
}: AddMediaModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { addItem } = useMediaListMutations(mediaListId);

  const [query, debouncedQuery, setQuery] = useDebouncedState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  // The component stays mounted between openings, so whatever was searched and added
  // has to be cleared on the way out or the next list opens onto the last one's session.
  const close = (done: () => void) => {
    setQuery('');
    setFilter('all');
    setAdded(new Set());
    done();
  };

  const { data } = useSWR<SearchResponse>(
    debouncedQuery.trim()
      ? `/api/v1/search?query=${encodeURIComponent(debouncedQuery.trim())}`
      : null
  );

  // Titles already on the list, independent of anything added this session, so a
  // result reads as "Added" the moment it is searched rather than only after it is
  // clicked once.
  const { data: existingItems } = useMediaListItems(mediaListId, 'all');
  const existingKeys = useMemo(
    () =>
      new Set(
        (existingItems ?? []).map((item) => `${item.mediaType}-${item.tmdbId}`)
      ),
    [existingItems]
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
      setAdded((current) => new Set(current).add(key));
    } catch (e) {
      // A duplicate is a normal thing to hit while browsing, so it reads as a note
      // rather than a failure. It also means the title is on the list, which is what
      // the row should say from now on.
      const isDuplicate =
        (e as { response?: { status?: number } })?.response?.status === 409;
      if (isDuplicate) {
        setAdded((current) => new Set(current).add(key));
      }
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
    { value: 'all', label: intl.formatMessage(globalMessages.all) },
    { value: 'movie', label: intl.formatMessage(globalMessages.movies) },
    { value: 'tv', label: intl.formatMessage(globalMessages.tvshows) },
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
        subTitle={mediaListName}
        okText={intl.formatMessage(globalMessages.close)}
        onOk={() => close(onComplete)}
        onCancel={() => close(onCancel)}
      >
        <label htmlFor="watchlist-add-search" className="sr-only">
          {intl.formatMessage(messages.searchlabel)}
        </label>
        <div className="relative mt-2 flex items-center">
          <MagnifyingGlassIcon className="absolute left-3 h-5 w-5 text-gray-400" />
          <input
            id="watchlist-add-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={intl.formatMessage(messages.searchlabel)}
            className="!pl-10"
          />
        </div>

        <div className="mt-3 flex gap-2">
          {filters.map((option) => (
            <Button
              key={option.value}
              buttonType={filter === option.value ? 'primary' : 'default'}
              buttonSize="sm"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {results.map((result) => {
            const key = keyOf(result);
            const isAdded = existingKeys.has(key) || added.has(key);
            const isSeries = result.mediaType === 'tv';
            const title = isSeries
              ? (result as TvResult).name
              : (result as MovieResult).title;
            const released = isSeries
              ? (result as TvResult).firstAirDate
              : (result as MovieResult).releaseDate;

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
                  <Link
                    href={isSeries ? `/tv/${result.id}` : `/movie/${result.id}`}
                    target="_blank"
                    className="block truncate text-sm font-semibold text-gray-100 hover:underline"
                  >
                    {title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>
                      {intl.formatMessage(
                        isSeries ? globalMessages.tvshow : globalMessages.movie
                      )}
                    </span>
                    {/* The year alone is what tells two versions of a title apart in a
                        search result, which is the point of showing a date here. */}
                    {released && (
                      <>
                        <span className="text-gray-600">&middot;</span>
                        <span>
                          {intl.formatDate(released, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  data-testid="watchlist-add-result"
                  buttonType={isAdded ? 'success' : 'default'}
                  buttonSize="sm"
                  disabled={isAdded || pending === key}
                  onClick={() => onAdd(result)}
                >
                  {isAdded ? <CheckIcon /> : <PlusIcon />}
                  <span>
                    {intl.formatMessage(
                      isAdded ? messages.added : messages.add
                    )}
                  </span>
                </Button>
              </div>
            );
          })}

          {debouncedQuery.trim() && results.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              {intl.formatMessage(globalMessages.noresults)}
            </div>
          )}
        </div>

        {added.size > 0 && (
          <div className="mt-3 text-sm text-gray-400">
            {intl.formatMessage(messages.addedcount, { count: added.size })}
          </div>
        )}
      </Modal>
    </Transition>
  );
};

export default AddMediaModal;
