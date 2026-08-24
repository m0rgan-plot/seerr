import type { MediaType } from '@server/constants/media';
import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type { MediaListInvite } from '@server/features/mediaLists/domain/entities/MediaListInvite';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import type { NotificationGateway } from '@server/features/mediaLists/domain/ports/NotificationGateway';
import type { TvMetadataProvider } from '@server/features/mediaLists/domain/ports/TvMetadataProvider';
import type { MediaListCollaboratorRepository } from '@server/features/mediaLists/domain/repositories/MediaListCollaboratorRepository';
import type {
  AddMediaListItemInput,
  MediaListItemRepository,
} from '@server/features/mediaLists/domain/repositories/MediaListItemRepository';
import type {
  CreateMediaListInput,
  MediaListRepository,
  UpdateMediaListInput,
} from '@server/features/mediaLists/domain/repositories/MediaListRepository';
import type { MediaListWatchRepository } from '@server/features/mediaLists/domain/repositories/MediaListWatchRepository';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import { InviteStatus } from '@server/features/mediaLists/domain/valueObjects/InviteStatus';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import type {
  EpisodeRef,
  SeasonEpisodeCount,
} from '@server/features/mediaLists/domain/valueObjects/WatchProgress';
import { episodeRefKey } from '@server/features/mediaLists/domain/valueObjects/WatchProgress';

export const user = (id: number, displayName = `user${id}`): UserRef => ({
  id,
  displayName,
  avatar: `https://example.test/${id}.png`,
});

export class FakeMediaListRepository implements MediaListRepository {
  public lists: MediaList[] = [];
  private nextId = 1;

  constructor(
    private readonly users: Map<number, UserRef>,
    // Shared lists are reachable too, so the double has to know about collaborators or
    // it quietly under-reports what a member can see.
    private readonly collaborators?: FakeMediaListCollaboratorRepository
  ) {}

  async findById(id: number): Promise<MediaList | null> {
    return this.lists.find((list) => list.id === id) ?? null;
  }

  async findAccessibleTo(userId: number): Promise<MediaList[]> {
    const shared = (this.collaborators?.rows ?? [])
      .filter(
        (row) => row.user.id === userId && row.status === InviteStatus.ACCEPTED
      )
      .map((row) => row.listId);

    return this.lists.filter(
      (list) => list.owner.id === userId || shared.includes(list.id)
    );
  }

  async create(input: CreateMediaListInput): Promise<MediaList> {
    const owner = this.users.get(input.ownerId) ?? user(input.ownerId);
    const list: MediaList = {
      id: this.nextId++,
      name: input.name,
      description: input.description,
      owner,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.lists.push(list);
    return list;
  }

  async update(id: number, changes: UpdateMediaListInput): Promise<MediaList> {
    const list = this.lists.find((candidate) => candidate.id === id);
    if (!list) {
      throw new Error(`no list ${id}`);
    }
    if (changes.name !== undefined) {
      list.name = changes.name;
    }
    if (changes.description !== undefined) {
      list.description = changes.description;
    }
    list.updatedAt = new Date();
    return list;
  }

  async delete(id: number): Promise<void> {
    this.lists = this.lists.filter((list) => list.id !== id);
  }

  async touch(id: number): Promise<void> {
    const list = this.lists.find((candidate) => candidate.id === id);
    if (!list) {
      throw new Error(`no list ${id}`);
    }
    list.updatedAt = new Date();
  }
}

export class FakeMediaListItemRepository implements MediaListItemRepository {
  public items: MediaListItem[] = [];
  private nextId = 1;

  constructor(private readonly users: Map<number, UserRef>) {}

  async findById(itemId: number): Promise<MediaListItem | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async findByList(listId: number): Promise<MediaListItem[]> {
    return this.items
      .filter((item) => item.listId === listId)
      .sort((a, b) => a.position - b.position);
  }

  async findInList(
    listId: number,
    tmdbId: number,
    mediaType: MediaType
  ): Promise<MediaListItem | null> {
    return (
      this.items.find(
        (item) =>
          item.listId === listId &&
          item.tmdbId === tmdbId &&
          item.mediaType === mediaType
      ) ?? null
    );
  }

  async add(input: AddMediaListItemInput): Promise<MediaListItem> {
    const siblings = this.items.filter((item) => item.listId === input.listId);
    const item: MediaListItem = {
      id: this.nextId++,
      listId: input.listId,
      tmdbId: input.tmdbId,
      mediaType: input.mediaType,
      position: siblings.length,
      // Nothing has requested a title the moment it is put on a list.
      status: null,
      addedBy: this.users.get(input.addedById) ?? user(input.addedById),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.push(item);
    return item;
  }

  async remove(itemId: number): Promise<void> {
    this.items = this.items.filter((item) => item.id !== itemId);
  }

  async applyOrder(listId: number, orderedItemIds: number[]): Promise<void> {
    orderedItemIds.forEach((itemId, index) => {
      const item = this.items.find(
        (candidate) => candidate.id === itemId && candidate.listId === listId
      );
      if (item) {
        item.position = index;
      }
    });
  }

  async findListIdsContaining(
    listIds: number[],
    tmdbId: number,
    mediaType: MediaType
  ): Promise<number[]> {
    const matches = this.items.filter(
      (item) =>
        listIds.includes(item.listId) &&
        item.tmdbId === tmdbId &&
        item.mediaType === mediaType
    );
    return [...new Set(matches.map((item) => item.listId))];
  }
}

export class FakeMediaListCollaboratorRepository implements MediaListCollaboratorRepository {
  public rows: (Collaborator & { listId: number })[] = [];
  // Records every call's argument list, so a test can assert the batched lookup fires
  // once per request rather than once per list.
  public findByListsCalls: number[][] = [];
  // Set by the harness to the same array FakeMediaListRepository holds, once both exist.
  // findPendingInvitesFor is the only method here that needs to look a list up.
  public lists: MediaList[] = [];

  constructor(private readonly users: Map<number, UserRef>) {}

  async findByList(listId: number): Promise<Collaborator[]> {
    return this.rows.filter((row) => row.listId === listId);
  }

  async findByLists(listIds: number[]): Promise<Map<number, Collaborator[]>> {
    this.findByListsCalls.push(listIds);

    const byList = new Map<number, Collaborator[]>();
    this.rows
      .filter(
        (row) =>
          listIds.includes(row.listId) && row.status === InviteStatus.ACCEPTED
      )
      .forEach((row) => {
        const collaborators = byList.get(row.listId) ?? [];
        collaborators.push(row);
        byList.set(row.listId, collaborators);
      });
    return byList;
  }

  async findRole(
    listId: number,
    userId: number
  ): Promise<CollaboratorRole | null> {
    return (
      this.rows.find((row) => row.listId === listId && row.user.id === userId)
        ?.role ?? null
    );
  }

  async findAcceptedRole(
    listId: number,
    userId: number
  ): Promise<CollaboratorRole | null> {
    return (
      this.rows.find(
        (row) =>
          row.listId === listId &&
          row.user.id === userId &&
          row.status === InviteStatus.ACCEPTED
      )?.role ?? null
    );
  }

  async findPendingInvite(
    listId: number,
    userId: number
  ): Promise<Collaborator | null> {
    return (
      this.rows.find(
        (row) =>
          row.listId === listId &&
          row.user.id === userId &&
          row.status === InviteStatus.PENDING
      ) ?? null
    );
  }

  async findPendingInvitesFor(userId: number): Promise<MediaListInvite[]> {
    return this.rows
      .filter(
        (row) => row.user.id === userId && row.status === InviteStatus.PENDING
      )
      .map((row) => ({
        list: this.lists.find((list) => list.id === row.listId) as MediaList,
        role: row.role,
        invitedBy: row.invitedBy,
        createdAt: row.createdAt,
      }));
  }

  async add(input: {
    listId: number;
    userId: number;
    role: CollaboratorRole;
    invitedById: number;
  }): Promise<Collaborator> {
    const row = {
      listId: input.listId,
      user: this.users.get(input.userId) ?? user(input.userId),
      role: input.role,
      status: InviteStatus.PENDING,
      invitedBy: this.users.get(input.invitedById) ?? user(input.invitedById),
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  async accept(listId: number, userId: number): Promise<Collaborator> {
    const row = this.rows.find(
      (candidate) => candidate.listId === listId && candidate.user.id === userId
    );
    if (!row) {
      throw new Error('no collaborator');
    }
    row.status = InviteStatus.ACCEPTED;
    return row;
  }

  async updateRole(
    listId: number,
    userId: number,
    role: CollaboratorRole
  ): Promise<Collaborator> {
    const row = this.rows.find(
      (candidate) => candidate.listId === listId && candidate.user.id === userId
    );
    if (!row) {
      throw new Error('no collaborator');
    }
    row.role = role;
    return row;
  }

  async remove(listId: number, userId: number): Promise<void> {
    this.rows = this.rows.filter(
      (row) => !(row.listId === listId && row.user.id === userId)
    );
  }
}

export class FakeMediaListWatchRepository implements MediaListWatchRepository {
  public movieWatches = new Set<string>();
  public episodeWatches = new Set<string>();

  private movieKey = (itemId: number, userId: number) => `${itemId}:${userId}`;
  private episodeKey = (itemId: number, userId: number, episode: EpisodeRef) =>
    `${itemId}:${userId}:${episodeRefKey(episode)}`;

  async isMovieWatched(itemId: number, userId: number): Promise<boolean> {
    return this.movieWatches.has(this.movieKey(itemId, userId));
  }

  async setMovieWatched(itemId: number, userId: number): Promise<void> {
    this.movieWatches.add(this.movieKey(itemId, userId));
  }

  async clearMovieWatched(itemId: number, userId: number): Promise<void> {
    this.movieWatches.delete(this.movieKey(itemId, userId));
  }

  async findWatchedEpisodes(
    itemId: number,
    userId: number
  ): Promise<EpisodeRef[]> {
    const prefix = `${itemId}:${userId}:`;
    return [...this.episodeWatches]
      .filter((key) => key.startsWith(prefix))
      .map((key) => {
        const [seasonNumber, episodeNumber] = key
          .slice(prefix.length)
          .split(':')
          .map(Number);
        return { seasonNumber, episodeNumber };
      });
  }

  async setEpisodesWatched(
    itemId: number,
    userId: number,
    episodes: EpisodeRef[]
  ): Promise<void> {
    episodes.forEach((episode) =>
      this.episodeWatches.add(this.episodeKey(itemId, userId, episode))
    );
  }

  async clearEpisodesWatched(
    itemId: number,
    userId: number,
    episodes: EpisodeRef[]
  ): Promise<void> {
    episodes.forEach((episode) =>
      this.episodeWatches.delete(this.episodeKey(itemId, userId, episode))
    );
  }

  async clearSeasonWatched(
    itemId: number,
    userId: number,
    seasonNumber: number
  ): Promise<void> {
    const prefix = `${itemId}:${userId}:${seasonNumber}:`;
    [...this.episodeWatches]
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => this.episodeWatches.delete(key));
  }

  async findMovieWatchesForItems(itemIds: number[]) {
    return [...this.movieWatches]
      .map((key) => key.split(':').map(Number))
      .filter(([itemId]) => itemIds.includes(itemId))
      .map(([itemId, userId]) => ({ itemId, userId }));
  }

  async findEpisodeWatchesForItems(itemIds: number[]) {
    return [...this.episodeWatches]
      .map((key) => key.split(':').map(Number))
      .filter(([itemId]) => itemIds.includes(itemId))
      .map(([itemId, userId, seasonNumber, episodeNumber]) => ({
        itemId,
        userId,
        seasonNumber,
        episodeNumber,
      }));
  }
}

export class FakeTvMetadataProvider implements TvMetadataProvider {
  constructor(private seasons: SeasonEpisodeCount[] = []) {}

  setSeasons(seasons: SeasonEpisodeCount[]): void {
    this.seasons = seasons;
  }

  async getSeasonEpisodeCounts(): Promise<SeasonEpisodeCount[]> {
    return this.seasons;
  }

  async getSeasonEpisodeNumbers(
    _tmdbId: number,
    seasonNumber: number
  ): Promise<number[]> {
    const season = this.seasons.find(
      (candidate) => candidate.seasonNumber === seasonNumber
    );
    if (!season) {
      return [];
    }
    return Array.from({ length: season.episodeCount }, (_, i) => i + 1);
  }
}

export class FakeNotificationGateway implements NotificationGateway {
  public shared: Parameters<NotificationGateway['notifyListShared']>[0][] = [];
  public itemsAdded: Parameters<NotificationGateway['notifyItemAdded']>[0][] =
    [];

  async notifyListShared(
    input: Parameters<NotificationGateway['notifyListShared']>[0]
  ): Promise<void> {
    this.shared.push(input);
  }

  async notifyItemAdded(
    input: Parameters<NotificationGateway['notifyItemAdded']>[0]
  ): Promise<void> {
    this.itemsAdded.push(input);
  }
}
