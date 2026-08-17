import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { InviteStatus } from '@server/features/mediaLists/domain/valueObjects/InviteStatus';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

// The owner is never represented as a collaborator. Ownership lives on the list itself,
// which is what keeps "only the author can delete" expressible without a role that
// outranks write.
export interface Collaborator {
  user: UserRef;
  role: CollaboratorRole;
  // Pending until the invited user accepts. A row is never rejected in place: rejecting
  // deletes it, so this only ever moves one way, pending -> accepted.
  status: InviteStatus;
  invitedBy: UserRef | null;
  createdAt: Date;
}
