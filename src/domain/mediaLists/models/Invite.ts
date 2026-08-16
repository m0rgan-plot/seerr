import type { CollaboratorRole } from '@app/domain/mediaLists/models/Collaborator';
import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';

// A pending invite as seen by the invited user. Carries an item count but never the
// items themselves, so accepting or rejecting is never a decision made on list contents.
export interface WatchlistInvite {
  listId: number;
  listName: string;
  role: CollaboratorRole;
  invitedBy: MediaListUser | null;
  itemCount: number;
  createdAt: Date;
}
