import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

// The owner is never represented as a collaborator. Ownership lives on the list itself,
// which is what keeps "only the author can delete" expressible without a role that
// outranks write.
export interface Collaborator {
  user: UserRef;
  role: CollaboratorRole;
  invitedBy: UserRef | null;
  createdAt: Date;
}
