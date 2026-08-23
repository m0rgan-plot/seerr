import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import { MediaListAccessDeniedError } from '@server/features/mediaLists/domain/errors/MediaListErrors';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type {
  MediaListAction,
  MediaListMembership,
} from '@server/features/mediaLists/domain/valueObjects/MediaListMembership';

// The whole permission model for this feature lives here. Services resolve a membership
// and ask; no rule is restated at a route or in a component.
export class MediaListAccessPolicy {
  public resolveMembership(
    list: MediaList,
    userId: number,
    collaboratorRole: CollaboratorRole | null
  ): MediaListMembership {
    if (list.owner.id === userId) {
      return { kind: 'owner' };
    }
    if (collaboratorRole) {
      return { kind: 'collaborator', role: collaboratorRole };
    }
    return { kind: 'none' };
  }

  public can(
    membership: MediaListMembership,
    action: MediaListAction
  ): boolean {
    if (membership.kind === 'none') {
      return false;
    }

    if (membership.kind === 'owner') {
      // The owner can do everything except leave, which only makes sense for someone
      // who was invited. Handing the list over is not something v1 supports.
      return action !== 'leaveList';
    }

    switch (action) {
      case 'viewList':
      case 'trackOwnProgress':
      case 'leaveList':
        return true;
      case 'editListDetails':
      case 'editListItems':
        return membership.role === CollaboratorRole.WRITE;
      case 'deleteList':
      case 'manageCollaborators':
        return false;
      default:
        return false;
    }
  }

  public assertCan(
    membership: MediaListMembership,
    action: MediaListAction
  ): void {
    if (!this.can(membership, action)) {
      throw new MediaListAccessDeniedError();
    }
  }
}
