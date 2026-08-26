import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import type { MediaListInvite } from '@server/features/mediaLists/domain/entities/MediaListInvite';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';

export interface MediaListCollaboratorRepository {
  findByList(listId: number): Promise<Collaborator[]>;
  // Batched form of findByList, keyed by list id. Lets a caller resolve collaborators
  // for every list on the index in one query instead of one per list.
  findByLists(listIds: number[]): Promise<Map<number, Collaborator[]>>;
  // Used on every request to resolve the caller's membership, so it stays a single
  // lookup rather than loading the whole collaborator set. Returns a role for any row
  // regardless of invite status: this is the "does a collaborator row exist" check used
  // for management (share's duplicate check, changeRole, remove), not for access.
  findRole(listId: number, userId: number): Promise<CollaboratorRole | null>;
  // The access-control counterpart to findRole: only an accepted row grants a role, so a
  // pending invitee resolves to no membership until they accept.
  findAcceptedRole(
    listId: number,
    userId: number
  ): Promise<CollaboratorRole | null>;
  // The pending row for one list and one user, for accept/reject to act on.
  findPendingInvite(
    listId: number,
    userId: number
  ): Promise<Collaborator | null>;
  // Every pending invite for a user, across all lists, for the index page's Invites
  // section.
  findPendingInvitesFor(userId: number): Promise<MediaListInvite[]>;
  add(input: {
    listId: number;
    userId: number;
    role: CollaboratorRole;
    invitedById: number;
  }): Promise<Collaborator>;
  accept(listId: number, userId: number): Promise<Collaborator>;
  updateRole(
    listId: number,
    userId: number,
    role: CollaboratorRole
  ): Promise<Collaborator>;
  remove(listId: number, userId: number): Promise<void>;
}
