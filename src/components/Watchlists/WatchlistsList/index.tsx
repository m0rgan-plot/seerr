import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import AddMediaModal from '@app/components/Watchlists/AddMediaModal';
import CreateEditWatchlistModal from '@app/components/Watchlists/CreateEditWatchlistModal';
import DeleteWatchlistModal from '@app/components/Watchlists/DeleteWatchlistModal';
import ShareWatchlistModal from '@app/components/Watchlists/ShareWatchlistModal';
import WatchlistShelf from '@app/components/Watchlists/WatchlistShelf';
import WatchlistsEmptyState from '@app/components/Watchlists/WatchlistsEmptyState';
import { useMediaLists } from '@app/domain/mediaLists/hooks/useMediaLists';
import type { MediaListSummary } from '@app/domain/mediaLists/models/MediaList';
import { canDeleteList } from '@app/domain/mediaLists/models/MediaList';
import useRetainedValue from '@app/hooks/useRetainedValue';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { BarsArrowDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistsList', {
  watchlists: 'Watchlists',
  mylists: 'My Lists',
  sharedwithme: 'Shared with Me',
  newwatchlist: 'New Watchlist',
  sortlastmodified: 'Last Modified',
  sorttitle: 'Title',
  sortcreated: 'Created',
});

type SortOption = 'updated' | 'title' | 'created';

const sortLists = (
  lists: MediaListSummary[],
  sortBy: SortOption
): MediaListSummary[] =>
  [...lists].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.name.localeCompare(b.name);
      case 'created':
        return b.createdAt.getTime() - a.createdAt.getTime();
      case 'updated':
      default:
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
  });

const WatchlistsList = () => {
  const intl = useIntl();
  const { data, error, isLoading } = useMediaLists();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MediaListSummary | undefined>();
  const [deleting, setDeleting] = useState<MediaListSummary | undefined>();
  const [adding, setAdding] = useState<MediaListSummary | undefined>();
  const [sharing, setSharing] = useState<MediaListSummary | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Each modal outlives the state that closed it by the length of its leave transition.
  const editingList = useRetainedValue(editing);
  const deletingList = useRetainedValue(deleting);
  const addingList = useRetainedValue(adding);
  const sharingList = useRetainedValue(sharing);

  const { owned, shared } = useMemo(
    () => ({
      owned: sortLists(
        data?.filter((list) => list.role === 'owner') ?? [],
        sortBy
      ),
      shared: data?.filter((list) => list.role !== 'owner') ?? [],
    }),
    [data, sortBy]
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const isEmpty = owned.length === 0 && shared.length === 0;

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.watchlists)} />

      <div className="mb-5 mt-1 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(messages.watchlists)}</Header>
        {!isEmpty && (
          <div className="mt-2 flex flex-grow lg:mt-0 lg:flex-grow-0">
            <Button
              buttonType="primary"
              onClick={() => setShowCreate(true)}
              className="flex-grow lg:flex-grow-0"
            >
              <PlusIcon />
              <span>{intl.formatMessage(messages.newwatchlist)}</span>
            </Button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <WatchlistsEmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="flex flex-col gap-6">
          {owned.length > 0 && (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="slider-title">
                  {intl.formatMessage(messages.mylists)}
                </h2>
                <div className="flex">
                  <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
                    <BarsArrowDownIcon className="h-5 w-5" />
                  </span>
                  <select
                    id="mediaListSortBy"
                    name="mediaListSortBy"
                    className="rounded-r-only short"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                  >
                    <option value="updated">
                      {intl.formatMessage(messages.sortlastmodified)}
                    </option>
                    <option value="title">
                      {intl.formatMessage(messages.sorttitle)}
                    </option>
                    <option value="created">
                      {intl.formatMessage(messages.sortcreated)}
                    </option>
                  </select>
                </div>
              </div>
              <div className="mt-2">
                {owned.map((list) => (
                  <WatchlistShelf
                    key={list.id}
                    list={list}
                    onOpenOptions={setEditing}
                    onAddMedia={setAdding}
                    onShare={setSharing}
                  />
                ))}
              </div>
            </section>
          )}

          {shared.length > 0 && (
            <section>
              <h2 className="slider-title">
                {intl.formatMessage(messages.sharedwithme)}
              </h2>
              <div className="mt-2">
                {shared.map((list) => (
                  <WatchlistShelf
                    key={list.id}
                    list={list}
                    showOwner
                    // A collaborator can rename a list they may write to, so the
                    // options entry point stays available to them. Sharing is the
                    // owner's alone and has no entry point here.
                    onOpenOptions={
                      list.role === 'write' ? setEditing : undefined
                    }
                    onAddMedia={setAdding}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <CreateEditWatchlistModal
        show={showCreate}
        onComplete={() => setShowCreate(false)}
        onCancel={() => setShowCreate(false)}
      />

      <CreateEditWatchlistModal
        show={!!editing}
        list={editingList}
        onComplete={() => setEditing(undefined)}
        onCancel={() => setEditing(undefined)}
        onRequestDelete={() => {
          if (editing && canDeleteList(editing.role)) {
            setDeleting(editing);
            setEditing(undefined);
          }
        }}
      />

      <DeleteWatchlistModal
        show={!!deleting}
        list={deletingList}
        onComplete={() => setDeleting(undefined)}
        onCancel={() => setDeleting(undefined)}
      />

      {/* Adding and sharing both act on one list, so the modals are rendered once here
          rather than once per shelf. */}
      {addingList && (
        <AddMediaModal
          show={!!adding}
          mediaListId={addingList.id}
          mediaListName={addingList.name}
          onComplete={() => setAdding(undefined)}
          onCancel={() => setAdding(undefined)}
        />
      )}

      {sharingList && (
        <ShareWatchlistModal
          show={!!sharing}
          list={sharingList}
          onCancel={() => setSharing(undefined)}
        />
      )}
    </>
  );
};

export default WatchlistsList;
