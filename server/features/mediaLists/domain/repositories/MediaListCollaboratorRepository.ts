import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';

export interface MediaListCollaboratorRepository {
  findByList(listId: number): Promise<Collaborator[]>;
  // Used on every request to resolve the caller's membership, so it stays a single
  // lookup rather than loading the whole collaborator set.
  findRole(listId: number, userId: number): Promise<CollaboratorRole | null>;
  add(input: {
    listId: number;
    userId: number;
    role: CollaboratorRole;
    invitedById: number;
  }): Promise<Collaborator>;
  updateRole(
    listId: number,
    userId: number,
    role: CollaboratorRole
  ): Promise<Collaborator>;
  remove(listId: number, userId: number): Promise<void>;
}
