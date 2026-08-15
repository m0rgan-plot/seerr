import { MediaListAccessPolicy } from '@server/features/mediaLists/domain/services/MediaListAccessPolicy';
import { MediaListCollaboratorService } from '@server/features/mediaLists/domain/services/MediaListCollaboratorService';
import { MediaListItemService } from '@server/features/mediaLists/domain/services/MediaListItemService';
import { MediaListProgressCalculator } from '@server/features/mediaLists/domain/services/MediaListProgressCalculator';
import { MediaListService } from '@server/features/mediaLists/domain/services/MediaListService';
import { MediaListViewService } from '@server/features/mediaLists/domain/services/MediaListViewService';
import { MediaListWatchService } from '@server/features/mediaLists/domain/services/MediaListWatchService';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import {
  FakeMediaListCollaboratorRepository,
  FakeMediaListItemRepository,
  FakeMediaListRepository,
  FakeMediaListWatchRepository,
  FakeNotificationGateway,
  FakeTvMetadataProvider,
  user,
} from './fakes';

export const OWNER = user(1, 'owner');
export const WRITER = user(2, 'writer');
export const READER = user(3, 'reader');
export const STRANGER = user(4, 'stranger');

// A title TMDB has no art for.
export const MISSING_ARTWORK_TMDB_ID = 4040;

// Wires the real services against in-memory doubles. No database, no Express, no TMDB.
export const buildHarness = () => {
  const users = new Map<number, UserRef>(
    [OWNER, WRITER, READER, STRANGER].map((entry) => [entry.id, entry])
  );

  const collaborators = new FakeMediaListCollaboratorRepository(users);
  const lists = new FakeMediaListRepository(users, collaborators);
  const items = new FakeMediaListItemRepository(users);
  const watches = new FakeMediaListWatchRepository();
  const tv = new FakeTvMetadataProvider();
  const notifications = new FakeNotificationGateway();

  const access = new MediaListAccessPolicy();
  const progress = new MediaListProgressCalculator();
  const listService = new MediaListService(lists, collaborators, access);
  const itemService = new MediaListItemService(
    items,
    collaborators,
    listService,
    access,
    notifications
  );
  const watchService = new MediaListWatchService(
    watches,
    items,
    listService,
    access,
    tv,
    progress
  );
  // Returns predictable values so a test can tell a resolved title from a missing one.
  const summaryCalls: number[] = [];
  const summaries = {
    getSummary: async (tmdbId: number) => (
      summaryCalls.push(tmdbId),
      tmdbId === MISSING_ARTWORK_TMDB_ID
        ? null
        : {
            title: `Title ${tmdbId}`,
            posterPath: `/poster-${tmdbId}.jpg`,
            year: 2026,
          }
    ),
  };

  const viewService = new MediaListViewService(
    lists,
    items,
    watches,
    collaborators,
    listService,
    access,
    tv,
    progress,
    summaries
  );

  const userDirectory = {
    findById: async (userId: number) => users.get(userId) ?? null,
  };
  const collaboratorService = new MediaListCollaboratorService(
    collaborators,
    listService,
    access,
    notifications,
    userDirectory
  );

  // A list owned by OWNER, shared write with WRITER and read with READER.
  const seedSharedList = async () => {
    const list = await listService.create({
      name: 'Sunday Night Sci-Fi',
      description: 'Slow burn',
      ownerId: OWNER.id,
    });
    await collaborators.add({
      listId: list.id,
      userId: WRITER.id,
      role: CollaboratorRole.WRITE,
      invitedById: OWNER.id,
    });
    await collaborators.add({
      listId: list.id,
      userId: READER.id,
      role: CollaboratorRole.READ,
      invitedById: OWNER.id,
    });
    return list;
  };

  return {
    lists,
    items,
    viewService,
    summaries,
    summaryCalls,
    collaborators,
    watches,
    tv,
    notifications,
    listService,
    itemService,
    watchService,
    collaboratorService,
    seedSharedList,
  };
};
