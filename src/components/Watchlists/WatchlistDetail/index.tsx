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
import useToasts from '@app/hooks/useToasts';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import {
  PencilSquareIcon,
  PlusIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.WatchlistDetail', {
  watchlists: 'Watchlists',
  addmedia: 'Add media',
  edit: 'Edit',
  share: 'Share',
  all: 'All',
  unseen: 'Unseen',
  inprogress: 'In progress',
  seen: 'Seen',
  seenprogress: "You've seen {watched} of {total}",
  empty: 'Nothing on this list yet.',
  emptyaction: 'Add the first title',
  emptyreadonly: 'The owner has not added anything yet.',
  removed: 'Removed from the watchlist.',
  removefailed: 'Something went wrong removing that title.',
  seenfailed: 'Something went wrong updating your watched state.',
});

const FILTERS: MediaListItemFilter[] = ['all', 'unseen', 'inprogress', 'seen'];

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

  const { data: list, error, isLoading } = useMediaList(mediaListId);
  const {
    data: items,
    isLoading: itemsLoading,
    revalidate,
  } = useMediaListItems(mediaListId, filter);
  const { setMovieWatched, removeItem } = useMediaListMutations(mediaListId);

  if (error) {
    return <Error statusCode={404} />;
  }

  if (isLoading || !list) {
    return <LoadingSpinner />;
  }

  const canEdit = canEditItems(list.role);
  const seenCount = items?.filter((item) => item.watched).length ?? 0;

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
            <span className="text-xs text-gray-500">
              {list.owner.displayName}
            </span>
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
            <button
              key={value}
              type="button"
              data-testid={`watchlist-filter-${value}`}
              onClick={() => setFilter(value)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition duration-150 ${
                filter === value
                  ? 'border-indigo-500 bg-indigo-600 bg-opacity-80 text-white'
                  : 'border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              {labelFor(value)}
            </button>
          ))}
        </div>

        {filter === 'all' && items && items.length > 0 && (
          <div className="text-sm text-gray-400">
            {intl.formatMessage(messages.seenprogress, {
              watched: seenCount,
              total: items.length,
            })}
          </div>
        )}
      </div>

      {itemsLoading ? (
        <LoadingSpinner />
      ) : items && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <Fragment key={item.id}>
              <WatchlistItemCard
                item={item}
                canEdit={canEdit}
                onToggleSeen={async () => {
                  try {
                    await setMovieWatched(item.id, !item.watched);
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

              {/* Spans the grid so the accordion opens under the row holding the card,
                  rather than squeezing into one poster's column. */}
              {trackingItemId === item.id && (
                <WatchlistEpisodeTracker
                  mediaListId={mediaListId}
                  item={item}
                  onClose={() => setTrackingItemId(null)}
                  onChanged={revalidate}
                />
              )}
            </Fragment>
          ))}
        </div>
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
