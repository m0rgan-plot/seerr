import type { MediaType } from '@server/constants/media';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';

export interface AddMediaListItemInput {
  listId: number;
  tmdbId: number;
  mediaType: MediaType;
  addedById: number;
}

export interface MediaListItemRepository {
  findById(itemId: number): Promise<MediaListItem | null>;
  findByList(listId: number): Promise<MediaListItem[]>;
  findInList(
    listId: number,
    tmdbId: number,
    mediaType: MediaType
  ): Promise<MediaListItem | null>;
  // Resolving the shared Media row for the title is a persistence concern and stays
  // behind this port. Appends to the end of the list.
  add(input: AddMediaListItemInput): Promise<MediaListItem>;
  remove(itemId: number): Promise<void>;
  // Applies the given order as a single unit so a failure cannot leave gaps.
  applyOrder(listId: number, orderedItemIds: number[]): Promise<void>;
  // Stamps or clears pinnedAt. Pinning again refreshes the timestamp, which is what
  // keeps the most recently pinned title ahead of one pinned earlier.
  pin(itemId: number): Promise<void>;
  unpin(itemId: number): Promise<void>;
  // Which of the given lists already hold this title, and the item id on each one, for
  // the media page's "already on this list" check -- the item id is what lets that
  // button remove the title again without a second lookup. Scoped to a candidate set
  // rather than global so it stays a single query against lists the caller can already
  // see, not every list in the database.
  findItemsContaining(
    listIds: number[],
    tmdbId: number,
    mediaType: MediaType
  ): Promise<{ listId: number; itemId: number }[]>;
}
