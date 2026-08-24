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
  PlusIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { MediaType } from '@server/constants/media';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Watchlists.AddToWatchlistButton', {
  addtowatchlist: 'Add to Watchlist',
  added: 'Added',
  addfailed: 'Something went wrong adding this title.',
  alreadyonlist: 'This title is already on {listName}.',
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
  const { addItem } = useMediaListMutations();
  const resolvedMediaType = mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE;
  // Lists that already hold this title, independent of anything added this session, so
  // a list reads "Added" as soon as the dropdown opens rather than only after a click.
  const { data: existingListIds } = useMediaListMembership(
    tmdbId,
    resolvedMediaType
  );

  const [added, setAdded] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<number | null>(null);

  // Only lists the signed-in member can actually write to are worth offering here; a
  // read-only share would just fail the add on the server.
  const editableLists = useMemo(
    () => (lists ?? []).filter((list) => canEditItems(list.role)),
    [lists]
  );

  const onAdd = async (listId: number, listName: string) => {
    setPending(listId);
    try {
      await addItem({ tmdbId, mediaType: resolvedMediaType }, listId);
      setAdded((current) => new Set(current).add(listId));
    } catch (e) {
      // A duplicate just means the title is already there, which is what the row
      // should reflect rather than reading as a failure.
      const isDuplicate =
        (e as { response?: { status?: number } })?.response?.status === 409;
      if (isDuplicate) {
        setAdded((current) => new Set(current).add(listId));
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

  return (
    <div className="z-40 mr-2">
      <Dropdown
        data-testid="add-to-watchlist-button"
        text={
          <>
            <RectangleStackIcon />
            <span>{intl.formatMessage(messages.addtowatchlist)}</span>
          </>
        }
        buttonType="ghost"
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
            const isAdded =
              added.has(list.id) || (existingListIds?.has(list.id) ?? false);
            return (
              <Dropdown.Item
                key={list.id}
                data-testid="add-to-watchlist-item"
                onClick={() => !isAdded && onAdd(list.id, list.name)}
                aria-disabled={isAdded || pending === list.id}
              >
                {isAdded ? <CheckIcon /> : <PlusIcon />}
                <span className="truncate">{list.name}</span>
              </Dropdown.Item>
            );
          })
        )}
      </Dropdown>
    </div>
  );
};

export default AddToWatchlistButton;
