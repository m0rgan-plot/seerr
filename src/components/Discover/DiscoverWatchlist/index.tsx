import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import { useUser } from '@app/hooks/useUser';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { BarsArrowDownIcon } from '@heroicons/react/24/solid';
import type { WatchlistItem } from '@server/interfaces/api/discoverInterfaces';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverWatchlist', {
  discoverwatchlist: 'Your Watchlist',
  watchlist: 'Plex Watchlist',
  sortAdded: 'Date Added',
  sortTitle: 'Title',
});

type SortOption = 'added' | 'title';

const DiscoverWatchlist = () => {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useUser({
    id: Number(router.query.userId),
  });
  const { user: currentUser } = useUser();
  const updateQueryParams = useUpdateQueryParams({});

  const sortBy = ((router.query.sortBy as string) || 'added') as SortOption;

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    mutate,
  } = useDiscover<WatchlistItem, unknown, { sortBy: SortOption }>(
    `/api/v1/${
      router.pathname.startsWith('/profile')
        ? `user/${currentUser?.id}`
        : router.query.userId
          ? `user/${router.query.userId}`
          : 'discover'
    }/watchlist`,
    { sortBy }
  );

  if (error) {
    return <ErrorPage statusCode={500} />;
  }

  const title = intl.formatMessage(
    router.query.userId ? messages.watchlist : messages.discoverwatchlist
  );

  return (
    <>
      <PageTitle
        title={[title, router.query.userId ? user?.displayName : '']}
      />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header
          subtext={
            router.query.userId ? (
              <Link href={`/users/${user?.id}`} className="hover:underline">
                {user?.displayName}
              </Link>
            ) : (
              ''
            )
          }
        >
          {title}
        </Header>
        <div className="mt-2 flex flex-grow sm:flex-row lg:flex-grow-0">
          <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
            <BarsArrowDownIcon className="h-6 w-6" />
          </span>
          <select
            id="sortBy"
            name="sortBy"
            className="rounded-r-only"
            value={sortBy}
            onChange={(e) => updateQueryParams('sortBy', e.target.value)}
          >
            <option value="added">
              {intl.formatMessage(messages.sortAdded)}
            </option>
            <option value="title">
              {intl.formatMessage(messages.sortTitle)}
            </option>
          </select>
        </div>
      </div>
      <ListView
        plexItems={titles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
        mutateParent={mutate}
      />
    </>
  );
};

export default DiscoverWatchlist;
