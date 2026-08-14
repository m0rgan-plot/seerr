import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

// Calling this is an explicit step in the use case rather than a persistence side
// effect, which is what lets the services be tested without the notification manager.
export interface NotificationGateway {
  notifyListShared(input: {
    list: MediaList;
    recipient: UserRef;
    role: CollaboratorRole;
    invitedBy: UserRef;
  }): Promise<void>;

  notifyItemAdded(input: {
    list: MediaList;
    item: MediaListItem;
    addedBy: UserRef;
    recipients: UserRef[];
  }): Promise<void>;
}
