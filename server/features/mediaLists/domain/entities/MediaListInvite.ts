import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

// A pending invite as seen by the invited user, across every list that has invited them.
// Deliberately carries no item data: the read model that adds a count lives in
// MediaListViewService, which is where item access already sits.
export interface MediaListInvite {
  list: MediaList;
  role: CollaboratorRole;
  invitedBy: UserRef | null;
  createdAt: Date;
}
