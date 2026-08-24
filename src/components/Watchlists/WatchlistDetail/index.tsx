import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import AddMediaModal from '@app/components/Watchlists/AddMediaModal';
import CreateEditWatchlistModal from '@app/components/Watchlists/CreateEditWatchlistModal';
import DeleteWatchlistModal from '@app/components/Watchlists/DeleteWatchlistModal';
import ShareWatchlistModal from '@app/components/Watchlists/ShareWatchlistModal';
import WatchlistEpisodeTracker from '@app/components/Watchlists/WatchlistEpisodeTracker';
import WatchlistItemCard from '@app/components/Watchlists/WatchlistItemCard';
import WatchlistRoleBadge from '@app/components/Watchlists/WatchlistRoleBadge';
import WatchlistSharedWithAvatars from '@app/components/Watchlists/WatchlistSharedWithAvatars';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import {
  useMediaList,
  useMediaListItems,
} from '@app/domain/mediaLists/hooks/useMediaLists';
import {
  canDeleteList,
  canEditItems,
  canManageCollaborators,
} from '@app/domain/mediaLists/models/MediaList';
import type { MediaListItemFilter } from '@app/domain/mediaLists/models/MediaListItem';
import { isSeries } from '@app/domain/mediaLists/models/MediaListItem';
import useToasts from '@app/hooks/useToasts';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import {
  BarsArrowDownIcon,
  PencilSquareIcon,
  PlusIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistDetail', {
  watchlists: 'Watchlists',
  addmedia: 'Add Media',
  edit: 'Edit',
  share: 'Share',
  all: 'All',
  unseen: 'Unseen',
  inprogress: 'In Progress',
  seen: 'Seen',
  seenprogress: "You've seen {watched} of {total}",
  empty: 'Nothing on this list yet.',
  emptyaction: 'Add the First Title',
  emptyreadonly: 'The owner has not added anything yet.',
  removed: 'Removed from the watchlist.',
  removefailed: 'Something went wrong removing that title.',
  seenfailed: 'Something went wrong updating your watched state.',
  sortadded: 'Added Date',
  sorttitle: 'Title',
});

const FILTERS: MediaListItemFilter[] = ['all', 'unseen', 'seen'];

type ItemSortOption = 'added' | 'title';

const sortItems = <T extends { title: string | null; createdAt: Date }>(
  items: T[],
  sortBy: ItemSortOption
): T[] =>
  [...items].sort((a, b) => {
    if (sortBy === 'title') {
      return (a.title ?? '').localeCompare(b.title ?? '');
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

const WatchlistDetail = ({ mediaListId }: { mediaListId: number }) => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();

  const [filter, setFilter] = useState<MediaListItemFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [trackingItemId, setTrackingItemId] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [sortBy, setSortBy] = useState<ItemSortOption>('added');

  const { data: list, error, isLoading } = useMediaList(mediaListId);
  const {
    data: items,
    isLoading: itemsLoading,
    revalidate,
  } = useMediaListItems(mediaListId, filter);
  const { setMovieWatched, setSeasonsWatched, removeItem } =
    useMediaListMutations(mediaListId);

  if (error) {
    return <Error statusCode={404} />;
  }

  if (isLoading || !list) {
    return <LoadingSpinner />;
  }

  const canEdit = canEditItems(list.role);
  const seenCount = items?.filter((item) => item.watched).length ?? 0;
  // Read back from the current items so the tracker follows a refresh rather than
  // holding the copy it was opened with.
  const trackedItem = items?.find((item) => item.id === trackingItemId) ?? null;

  const labelFor = (value: MediaListItemFilter) =>
    intl.formatMessage(messages[value]);

  return (
    <>
      <PageTitle title={[list.name, intl.formatMessage(messages.watchlists)]} />

      <div className="mb-1 mt-1 text-sm text-gray-400">
        <Link href="/watchlists" className="hover:text-white">
          {intl.formatMessage(messages.watchlists)}
        </Link>
      </div>

      <div className="mb-5 flex flex-col justify-between lg:flex-row lg:items-end">
        <div className="min-w-0">
          <Header>{list.name}</Header>
          {list.description && (
            <p className="mt-2 max-w-3xl text-sm text-gray-400">
              {list.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <WatchlistRoleBadge role={list.role} />
            <WatchlistSharedWithAvatars
              sharedWith={list.sharedWith}
              sharedWithCount={list.sharedWithCount}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2 lg:mt-0">
          {canManageCollaborators(list.role) && (
            <Button buttonType="default" onClick={() => setShowShare(true)}>
              <UserPlusIcon />
              <span>{intl.formatMessage(messages.share)}</span>
            </Button>
          )}
          {canEdit && (
            <Button buttonType="default" onClick={() => setShowEdit(true)}>
              <PencilSquareIcon />
              <span>{intl.formatMessage(messages.edit)}</span>
            </Button>
          )}
          {canEdit && (
            <Button buttonType="primary" onClick={() => setShowAdd(true)}>
              <PlusIcon />
              <span>{intl.formatMessage(messages.addmedia)}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 pt-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((value) => (
            <Button
              key={value}
              buttonType={filter === value ? 'primary' : 'default'}
              buttonSize="sm"
              data-testid={`watchlist-filter-${value}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {labelFor(value)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {filter === 'all' && items && items.length > 0 && (
            <div className="text-sm text-gray-400">
              {intl.formatMessage(messages.seenprogress, {
                watched: seenCount,
                total: items.length,
              })}
            </div>
          )}

          <div className="flex">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
              <BarsArrowDownIcon className="h-5 w-5" />
            </span>
            <select
              id="mediaListItemSortBy"
              name="mediaListItemSortBy"
              className="rounded-r-only short"
              data-testid="watchlist-item-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ItemSortOption)}
            >
              <option value="added">
                {intl.formatMessage(messages.sortadded)}
              </option>
              <option value="title">
                {intl.formatMessage(messages.sorttitle)}
              </option>
            </select>
          </div>
        </div>
      </div>

      {itemsLoading ? (
        <LoadingSpinner />
      ) : items && items.length > 0 ? (
        <>
          <ul className="cards-vertical">
            {/* Default is newest added first. Watching an item never touches createdAt,
                so ticking one off doesn't reshuffle the grid. */}
            {sortItems(items, sortBy).map((item) => (
              <li key={item.id}>
                <WatchlistItemCard
                  item={item}
                  canEdit={canEdit}
                  episodesOpen={trackingItemId === item.id}
                  onToggleSeen={async () => {
                    try {
                      // A series has no single watched flag server-side -- it tracks
                      // per episode -- so the same one-tap toggle a movie gets has to
                      // mark every trackable season instead of the title itself.
                      if (isSeries(item)) {
                        const trackableSeasons = (item.progress?.seasons ?? [])
                          .filter((season) => season.totalEpisodes > 0)
                          .map((season) => season.seasonNumber);
                        await setSeasonsWatched(
                          item.id,
                          trackableSeasons,
                          !item.watched
                        );
                      } else {
                        await setMovieWatched(item.id, !item.watched);
                      }
                    } catch {
                      addToast(intl.formatMessage(messages.seenfailed), {
                        appearance: 'error',
                        autoDismiss: true,
                      });
                    }
                  }}
                  onOpenEpisodes={() =>
                    setTrackingItemId((current) =>
                      current === item.id ? null : item.id
                    )
                  }
                  onRemove={async () => {
                    try {
                      await removeItem(item.id);
                      addToast(intl.formatMessage(messages.removed), {
                        appearance: 'success',
                        autoDismiss: true,
                      });
                    } catch {
                      addToast(intl.formatMessage(messages.removefailed), {
                        appearance: 'error',
                        autoDismiss: true,
                      });
                    }
                  }}
                  onRequestUpdate={revalidate}
                />
              </li>
            ))}
          </ul>

          {/* Below the grid rather than inside it: the columns are laid out by auto-fill
              now, and a full-width row in the middle would leave a hole beside it. */}
          {trackedItem && (
            <div className="mt-4">
              <WatchlistEpisodeTracker
                mediaListId={mediaListId}
                item={trackedItem}
                onClose={() => setTrackingItemId(null)}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-400">
            {intl.formatMessage(
              canEdit ? messages.empty : messages.emptyreadonly
            )}
          </p>
          {canEdit && (
            <Button buttonType="primary" onClick={() => setShowAdd(true)}>
              <PlusIcon />
              <span>{intl.formatMessage(messages.emptyaction)}</span>
            </Button>
          )}
        </div>
      )}

      <ShareWatchlistModal
        show={showShare}
        list={list}
        onCancel={() => setShowShare(false)}
      />

      <AddMediaModal
        show={showAdd}
        mediaListId={mediaListId}
        mediaListName={list.name}
        onComplete={() => setShowAdd(false)}
        onCancel={() => setShowAdd(false)}
      />

      <CreateEditWatchlistModal
        show={showEdit}
        list={list}
        onComplete={() => setShowEdit(false)}
        onCancel={() => setShowEdit(false)}
        onRequestDelete={() => {
          if (canDeleteList(list.role)) {
            setShowEdit(false);
            setShowDelete(true);
          }
        }}
      />

      <DeleteWatchlistModal
        show={showDelete}
        list={list}
        onComplete={() => {
          setShowDelete(false);
          router.push('/watchlists');
        }}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
};

export default WatchlistDetail;
