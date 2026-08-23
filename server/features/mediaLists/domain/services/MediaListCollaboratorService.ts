import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import {
  CannotCollaborateAsOwnerError,
  CollaboratorNotFoundError,
  DuplicateCollaboratorError,
  UserNotFoundError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import type { NotificationGateway } from '@server/features/mediaLists/domain/ports/NotificationGateway';
import type { UserDirectory } from '@server/features/mediaLists/domain/ports/UserDirectory';
import type { MediaListCollaboratorRepository } from '@server/features/mediaLists/domain/repositories/MediaListCollaboratorRepository';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import type { MediaListAccessPolicy } from './MediaListAccessPolicy';
import type { MediaListService } from './MediaListService';

export class MediaListCollaboratorService {
  constructor(
    private readonly collaborators: MediaListCollaboratorRepository,
    private readonly listService: MediaListService,
    private readonly access: MediaListAccessPolicy,
    private readonly notifications: NotificationGateway,
    private readonly users: UserDirectory
  ) {}

  public async listFor(
    listId: number,
    userId: number
  ): Promise<Collaborator[]> {
    const list = await this.listService.requireList(listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, userId),
      'viewList'
    );
    return this.collaborators.findByList(listId);
  }

  public async share(input: {
    listId: number;
    recipientId: number;
    role: CollaboratorRole;
    actor: UserRef;
  }): Promise<Collaborator> {
    const list = await this.listService.requireList(input.listId);
    // Permission first. Resolving the recipient before this would let anyone who can see
    // the list probe which user ids exist by telling 404 apart from 403.
    this.access.assertCan(
      await this.listService.membershipFor(list, input.actor.id),
      'manageCollaborators'
    );

    if (list.owner.id === input.recipientId) {
      throw new CannotCollaborateAsOwnerError();
    }

    const recipient = await this.users.findById(input.recipientId);
    if (!recipient) {
      throw new UserNotFoundError();
    }

    const existing = await this.collaborators.findRole(
      input.listId,
      input.recipientId
    );
    if (existing) {
      throw new DuplicateCollaboratorError();
    }

    const collaborator = await this.collaborators.add({
      listId: input.listId,
      userId: input.recipientId,
      role: input.role,
      invitedById: input.actor.id,
    });

    await this.notifications.notifyListShared({
      list,
      recipient,
      role: input.role,
      invitedBy: input.actor,
    });

    return collaborator;
  }

  public async changeRole(input: {
    listId: number;
    userId: number;
    role: CollaboratorRole;
    actorId: number;
  }): Promise<Collaborator> {
    const list = await this.listService.requireList(input.listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, input.actorId),
      'manageCollaborators'
    );

    const existing = await this.collaborators.findRole(
      input.listId,
      input.userId
    );
    if (!existing) {
      throw new CollaboratorNotFoundError();
    }

    return this.collaborators.updateRole(
      input.listId,
      input.userId,
      input.role
    );
  }

  // Removing someone else is an owner action, but anyone can walk away from a list that
  // was shared with them.
  public async remove(input: {
    listId: number;
    userId: number;
    actorId: number;
  }): Promise<void> {
    const list = await this.listService.requireList(input.listId);
    const membership = await this.listService.membershipFor(
      list,
      input.actorId
    );

    const isSelfRemoval = input.userId === input.actorId;
    if (isSelfRemoval) {
      this.access.assertCan(membership, 'leaveList');
    } else {
      this.access.assertCan(membership, 'manageCollaborators');
    }

    const existing = await this.collaborators.findRole(
      input.listId,
      input.userId
    );
    if (!existing) {
      throw new CollaboratorNotFoundError();
    }

    await this.collaborators.remove(input.listId, input.userId);
  }
}
