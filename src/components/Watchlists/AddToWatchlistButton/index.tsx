import Dropdown from '@app/components/Common/Dropdown';
import { useMediaListMutations } from '@app/domain/mediaLists/hooks/useMediaListMutations';
import {
  useMediaListMembership,
  useMediaLists,
} from '@app/domain/mediaLists/hooks/useMediaLists';
import { canEditItems } from '@app/domain/mediaLists/models/MediaList';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckIcon,
  MinusCircleIcon,
  PlusIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { MediaType } from '@server/constants/media';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.AddToWatchlistButton', {
  addtowatchlist: 'Add to Watchlist',
  added: 'Added to {listName}.',
  addfailed: 'Something went wrong adding this title.',
  alreadyonlist: 'This title is already on {listName}.',
  removed: 'Removed from {listName}.',
  removefailed: 'Something went wrong removing this title.',
  nolists: "You don't have any watchlists you can add to yet.",
  managewatchlists: 'Manage Watchlists',
});

interface AddToWatchlistButtonProps {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
}

const AddToWatchlistButton = ({
  mediaType,
  tmdbId,
}: AddToWatchlistButtonProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data: lists } = useMediaLists();
  const { addItem, removeItem } = useMediaListMutations();
  const resolvedMediaType = mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE;
  // Lists that already hold this title, mapped to the item id on each, independent of
  // anything added or removed this session, so a list reads correctly as soon as the
  // dropdown opens rather than only after a click.
  const { data: existingItems, revalidate: revalidateMembership } =
    useMediaListMembership(tmdbId, resolvedMediaType);

  // Session overrides layered on top of the server's membership snapshot: an add
  // records the id the server handed back so it can be removed again without waiting
  // on a refetch, a remove is recorded as a plain override since there is nothing left
  // to look up.
  const [sessionAdded, setSessionAdded] = useState<Map<number, number>>(
    new Map()
  );
  const [sessionRemoved, setSessionRemoved] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<number | null>(null);

  const itemIdByList = useMemo(() => {
    const map = new Map(existingItems ?? []);
    sessionRemoved.forEach((listId) => map.delete(listId));
    sessionAdded.forEach((itemId, listId) => map.set(listId, itemId));
    return map;
  }, [existingItems, sessionAdded, sessionRemoved]);

  // Only lists the signed-in member can actually write to are worth offering here; a
  // read-only share would just fail the add on the server.
  const editableLists = useMemo(
    () => (lists ?? []).filter((list) => canEditItems(list.role)),
    [lists]
  );

  const onAdd = async (listId: number, listName: string) => {
    setPending(listId);
    try {
      const item = await addItem(
        { tmdbId, mediaType: resolvedMediaType },
        listId
      );
      setSessionAdded((current) => new Map(current).set(listId, item.id));
      setSessionRemoved((current) => {
        const next = new Set(current);
        next.delete(listId);
        return next;
      });
      addToast(intl.formatMessage(messages.added, { listName }), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (e) {
      // A duplicate just means the title is already there. The membership snapshot
      // that said otherwise was stale, so refetch it rather than guessing an item id.
      const isDuplicate =
        (e as { response?: { status?: number } })?.response?.status === 409;
      if (isDuplicate) {
        revalidateMembership();
      }
      addToast(
        intl.formatMessage(
          isDuplicate ? messages.alreadyonlist : messages.addfailed,
          { listName }
        ),
        { appearance: isDuplicate ? 'info' : 'error', autoDismiss: true }
      );
    } finally {
      setPending(null);
    }
  };

  const onRemove = async (listId: number, itemId: number, listName: string) => {
    setPending(listId);
    try {
      await removeItem(itemId, listId);
      setSessionRemoved((current) => new Set(current).add(listId));
      setSessionAdded((current) => {
        const next = new Map(current);
        next.delete(listId);
        return next;
      });
      addToast(intl.formatMessage(messages.removed, { listName }), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.removefailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="relative z-40 mr-2">
      {/* A native title, not the app's Tooltip: that component's hover boundary covers
          the whole wrapped subtree, including the opened items list once it renders as
          a sibling of the trigger button here, so it stayed visible while hovering the
          list. A native title tooltip is scoped to the button element itself. */}
      <Dropdown
        data-testid="add-to-watchlist-button"
        text={<RectangleStackIcon />}
        buttonType="ghost"
        title={intl.formatMessage(messages.addtowatchlist)}
      >
        {editableLists.length === 0 ? (
          <div className="px-4 py-2 text-sm text-gray-400">
            <p>{intl.formatMessage(messages.nolists)}</p>
            <Link
              href="/watchlists"
              className="mt-1 inline-block text-indigo-400 hover:underline"
            >
              {intl.formatMessage(messages.managewatchlists)}
            </Link>
          </div>
        ) : (
          editableLists.map((list) => {
            const itemId = itemIdByList.get(list.id);
            const isAdded = itemId !== undefined;
            return (
              <Dropdown.Item
                key={list.id}
                buttonType="ghost"
                data-testid="add-to-watchlist-item"
                data-added={isAdded}
                onClick={() =>
                  isAdded
                    ? onRemove(list.id, itemId, list.name)
                    : onAdd(list.id, list.name)
                }
                aria-disabled={pending === list.id}
              >
                {isAdded ? (
                  <CheckIcon className="h-5 w-5 text-green-400" />
                ) : (
                  <PlusIcon className="h-5 w-5" />
                )}
                <span className="flex-1 truncate">{list.name}</span>
                {isAdded && (
                  <MinusCircleIcon className="ml-2 h-5 w-5 text-red-400" />
                )}
              </Dropdown.Item>
            );
          })
        )}
      </Dropdown>
    </div>
  );
};

export default AddToWatchlistButton;
