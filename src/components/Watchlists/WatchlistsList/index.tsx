import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import CreateEditWatchlistModal from '@app/components/Watchlists/CreateEditWatchlistModal';
import DeleteWatchlistModal from '@app/components/Watchlists/DeleteWatchlistModal';
import WatchlistShelf from '@app/components/Watchlists/WatchlistShelf';
import WatchlistsEmptyState from '@app/components/Watchlists/WatchlistsEmptyState';
import { useMediaLists } from '@app/domain/mediaLists/hooks/useMediaLists';
import type { MediaListSummary } from '@app/domain/mediaLists/models/MediaList';
import { canDeleteList } from '@app/domain/mediaLists/models/MediaList';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistsList', {
  watchlists: 'Watchlists',
  mylists: 'My lists',
  sharedwithme: 'Shared with me',
  newwatchlist: 'New watchlist',
});

const WatchlistsList = () => {
  const intl = useIntl();
  const { data, error, isLoading } = useMediaLists();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MediaListSummary | undefined>();
  const [deleting, setDeleting] = useState<MediaListSummary | undefined>();

  const { owned, shared } = useMemo(
    () => ({
      owned: data?.filter((list) => list.role === 'owner') ?? [],
      shared: data?.filter((list) => list.role !== 'owner') ?? [],
    }),
    [data]
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
              <h2 className="text-xl font-bold text-gray-300">
                {intl.formatMessage(messages.mylists)}
              </h2>
              <div className="mt-2">
                {owned.map((list) => (
                  <WatchlistShelf
                    key={list.id}
                    list={list}
                    onOpenOptions={setEditing}
                  />
                ))}
              </div>
            </section>
          )}

          {shared.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-300">
                {intl.formatMessage(messages.sharedwithme)}
              </h2>
              <div className="mt-2">
                {shared.map((list) => (
                  <WatchlistShelf
                    key={list.id}
                    list={list}
                    showOwner
                    // A collaborator can rename a list they may write to, so the
                    // options entry point stays available to them.
                    onOpenOptions={
                      list.role === 'write' ? setEditing : undefined
                    }
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
        list={editing}
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
        list={deleting}
        onComplete={() => setDeleting(undefined)}
        onCancel={() => setDeleting(undefined)}
      />
    </>
  );
};

export default WatchlistsList;
