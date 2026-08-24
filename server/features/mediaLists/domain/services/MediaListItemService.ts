import type { MediaType } from '@server/constants/media';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import {
  DuplicateMediaListItemError,
  InvalidReorderError,
  ItemNotFoundInListError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import type { NotificationGateway } from '@server/features/mediaLists/domain/ports/NotificationGateway';
import type { MediaListCollaboratorRepository } from '@server/features/mediaLists/domain/repositories/MediaListCollaboratorRepository';
import type { MediaListItemRepository } from '@server/features/mediaLists/domain/repositories/MediaListItemRepository';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import type { MediaListAccessPolicy } from './MediaListAccessPolicy';
import type { MediaListService } from './MediaListService';

export class MediaListItemService {
  constructor(
    private readonly items: MediaListItemRepository,
    private readonly collaborators: MediaListCollaboratorRepository,
    private readonly listService: MediaListService,
    private readonly access: MediaListAccessPolicy,
    private readonly notifications: NotificationGateway
  ) {}

  public async itemsOf(
    listId: number,
    userId: number
  ): Promise<MediaListItem[]> {
    const list = await this.listService.requireList(listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, userId),
      'viewList'
    );
    return this.items.findByList(listId);
  }

  // Which of the caller's own lists (owned or shared with them) already hold this
  // title, for the media page's "Add to Watchlist" button to show as already added
  // without requiring a click first.
  public async listIdsContaining(
    userId: number,
    tmdbId: number,
    mediaType: MediaType
  ): Promise<number[]> {
    const lists = await this.listService.listsFor(userId);
    return this.items.findListIdsContaining(
      lists.map((list) => list.id),
      tmdbId,
      mediaType
    );
  }

  public async add(input: {
    listId: number;
    tmdbId: number;
    mediaType: MediaType;
    actor: UserRef;
  }): Promise<MediaListItem> {
    const list = await this.listService.requireList(input.listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, input.actor.id),
      'editListItems'
    );

    const existing = await this.items.findInList(
      input.listId,
      input.tmdbId,
      input.mediaType
    );
    if (existing) {
      throw new DuplicateMediaListItemError();
    }

    const item = await this.items.add({
      listId: input.listId,
      tmdbId: input.tmdbId,
      mediaType: input.mediaType,
      addedById: input.actor.id,
    });
    await this.listService.touch(input.listId);

    // Everyone with access hears about it except whoever added it.
    const collaborators = await this.collaborators.findByList(input.listId);
    const recipients = [
      list.owner,
      ...collaborators.map((collaborator) => collaborator.user),
    ].filter((user) => user.id !== input.actor.id);

    if (recipients.length > 0) {
      await this.notifications.notifyItemAdded({
        list,
        item,
        addedBy: input.actor,
        recipients,
      });
    }

    return item;
  }

  public async remove(
    listId: number,
    itemId: number,
    userId: number
  ): Promise<void> {
    const list = await this.listService.requireList(listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, userId),
      'editListItems'
    );

    const item = await this.items.findById(itemId);
    if (!item || item.listId !== listId) {
      throw new ItemNotFoundInListError();
    }

    await this.items.remove(itemId);
    await this.listService.touch(listId);
  }

  public async reorder(
    listId: number,
    userId: number,
    orderedItemIds: number[]
  ): Promise<void> {
    const list = await this.listService.requireList(listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, userId),
      'editListItems'
    );

    const current = await this.items.findByList(listId);
    const currentIds = current.map((item) => item.id);
    const provided = new Set(orderedItemIds);

    // Reject anything that is not a permutation of the list, otherwise a stale client
    // could drop items out of the ordering entirely.
    if (
      provided.size !== orderedItemIds.length ||
      orderedItemIds.length !== currentIds.length ||
      !currentIds.every((id) => provided.has(id))
    ) {
      throw new InvalidReorderError();
    }

    await this.items.applyOrder(listId, orderedItemIds);
  }
}
