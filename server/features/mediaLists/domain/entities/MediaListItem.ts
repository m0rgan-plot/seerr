import type { MediaStatus, MediaType } from '@server/constants/media';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

export interface MediaListItem {
  id: number;
  listId: number;
  tmdbId: number;
  mediaType: MediaType;
  position: number;
  // Where the title stands in the library, shared with requests and issues. Null when
  // nothing in the app has ever tracked it. Watched state is separate and per member:
  // this is about availability, not about who has seen it.
  status: MediaStatus | null;
  // Null once the person who added it is deleted. The item stays.
  addedBy: UserRef | null;
  createdAt: Date;
}
