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
}
