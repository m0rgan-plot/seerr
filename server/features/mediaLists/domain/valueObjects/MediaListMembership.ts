import type { CollaboratorRole } from './CollaboratorRole';

// How the person making a request relates to the list they are acting on. Everything
// the access policy decides is a function of this value, so the rules stay in one place
// and can be exercised without a database.
export type MediaListMembership =
  | { kind: 'owner' }
  | { kind: 'collaborator'; role: CollaboratorRole }
  | { kind: 'none' };

export const ownerMembership = (): MediaListMembership => ({ kind: 'owner' });

export const collaboratorMembership = (
  role: CollaboratorRole
): MediaListMembership => ({ kind: 'collaborator', role });

export const noMembership = (): MediaListMembership => ({ kind: 'none' });

export type MediaListAction =
  // Read the list and its items.
  | 'viewList'
  // Rename the list or change its description.
  | 'editListDetails'
  // Add, remove or reorder items.
  | 'editListItems'
  // Delete the whole list. Reserved to the owner.
  | 'deleteList'
  // Invite, change a role, or remove someone else.
  | 'manageCollaborators'
  // Record your own seen state. Available to read-only collaborators too.
  | 'trackOwnProgress'
  // Remove yourself from a list someone shared with you.
  | 'leaveList';
