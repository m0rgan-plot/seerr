import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import { MediaListNotFoundError } from '@server/features/mediaLists/domain/errors/MediaListErrors';
import type { MediaListCollaboratorRepository } from '@server/features/mediaLists/domain/repositories/MediaListCollaboratorRepository';
import type { MediaListRepository } from '@server/features/mediaLists/domain/repositories/MediaListRepository';
import type { MediaListMembership } from '@server/features/mediaLists/domain/valueObjects/MediaListMembership';
import type { MediaListAccessPolicy } from './MediaListAccessPolicy';

export class MediaListService {
  constructor(
    private readonly lists: MediaListRepository,
    private readonly collaborators: MediaListCollaboratorRepository,
    private readonly access: MediaListAccessPolicy
  ) {}

  // Shared by every service that needs to check the caller before acting.
  public async membershipFor(
    list: MediaList,
    userId: number
  ): Promise<MediaListMembership> {
    // Only an accepted row grants access. findRole (any status) is reserved for
    // collaborator management, which needs to see a pending row too.
    const role = await this.collaborators.findAcceptedRole(list.id, userId);
    return this.access.resolveMembership(list, userId, role);
  }

  public async requireList(listId: number): Promise<MediaList> {
    const list = await this.lists.findById(listId);
    if (!list) {
      throw new MediaListNotFoundError();
    }
    return list;
  }

  public async listsFor(userId: number): Promise<MediaList[]> {
    return this.lists.findAccessibleTo(userId);
  }

  public async view(listId: number, userId: number): Promise<MediaList> {
    const list = await this.requireList(listId);
    this.access.assertCan(await this.membershipFor(list, userId), 'viewList');
    return list;
  }

  public async create(input: {
    name: string;
    description?: string | null;
    ownerId: number;
  }): Promise<MediaList> {
    return this.lists.create({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      ownerId: input.ownerId,
    });
  }

  public async update(
    listId: number,
    userId: number,
    changes: { name?: string; description?: string | null }
  ): Promise<MediaList> {
    const list = await this.requireList(listId);
    this.access.assertCan(
      await this.membershipFor(list, userId),
      'editListDetails'
    );

    return this.lists.update(listId, {
      ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
      ...(changes.description !== undefined
        ? { description: changes.description?.trim() || null }
        : {}),
    });
  }

  public async delete(listId: number, userId: number): Promise<void> {
    const list = await this.requireList(listId);
    this.access.assertCan(await this.membershipFor(list, userId), 'deleteList');
    await this.lists.delete(listId);
  }
}
