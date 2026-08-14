import type { MediaType } from '@server/constants/media';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

export interface MediaListItem {
  id: number;
  listId: number;
  tmdbId: number;
  mediaType: MediaType;
  position: number;
  // Null once the person who added it is deleted. The item stays.
  addedBy: UserRef | null;
  createdAt: Date;
}
