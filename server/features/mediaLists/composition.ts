import { NotificationGatewayImpl } from '@server/features/mediaLists/data/providers/NotificationGatewayImpl';
import { TmdbTvMetadataProvider } from '@server/features/mediaLists/data/providers/TmdbTvMetadataProvider';
import { TypeOrmMediaListCollaboratorRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListCollaboratorRepository';
import { TypeOrmMediaListItemRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListItemRepository';
import { TypeOrmMediaListRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListRepository';
import { TypeOrmMediaListWatchRepository } from '@server/features/mediaLists/data/repositories/TypeOrmMediaListWatchRepository';
import { TypeOrmUserDirectory } from '@server/features/mediaLists/data/repositories/TypeOrmUserDirectory';
import type { NotificationGateway } from '@server/features/mediaLists/domain/ports/NotificationGateway';
import type { TvMetadataProvider } from '@server/features/mediaLists/domain/ports/TvMetadataProvider';
import { MediaListAccessPolicy } from '@server/features/mediaLists/domain/services/MediaListAccessPolicy';
import { MediaListCollaboratorService } from '@server/features/mediaLists/domain/services/MediaListCollaboratorService';
import { MediaListItemService } from '@server/features/mediaLists/domain/services/MediaListItemService';
import { MediaListProgressCalculator } from '@server/features/mediaLists/domain/services/MediaListProgressCalculator';
import { MediaListService } from '@server/features/mediaLists/domain/services/MediaListService';
import { MediaListViewService } from '@server/features/mediaLists/domain/services/MediaListViewService';
import { MediaListWatchService } from '@server/features/mediaLists/domain/services/MediaListWatchService';

export interface MediaListServices {
  lists: MediaListService;
  items: MediaListItemService;
  watches: MediaListWatchService;
  collaborators: MediaListCollaboratorService;
  views: MediaListViewService;
  progress: MediaListProgressCalculator;
}

// Substitutes for the two ports that reach outside the database. Supplying them keeps a
// test from having to reach TMDB or the notification agents.
export interface MediaListPortOverrides {
  tv?: TvMetadataProvider;
  notifications?: NotificationGateway;
}

// The single place the domain meets its adapters. Routes import this rather than
// constructing services themselves, and a test can build the same graph over fakes.
export const buildMediaListServices = (
  overrides: MediaListPortOverrides = {}
): MediaListServices => {
  const listRepository = new TypeOrmMediaListRepository();
  const itemRepository = new TypeOrmMediaListItemRepository();
  const watchRepository = new TypeOrmMediaListWatchRepository();
  const collaboratorRepository = new TypeOrmMediaListCollaboratorRepository();
  const userDirectory = new TypeOrmUserDirectory();

  const tv = overrides.tv ?? new TmdbTvMetadataProvider();
  const notifications =
    overrides.notifications ?? new NotificationGatewayImpl();

  const access = new MediaListAccessPolicy();
  const progress = new MediaListProgressCalculator();

  const lists = new MediaListService(
    listRepository,
    collaboratorRepository,
    access
  );

  return {
    lists,
    progress,
    views: new MediaListViewService(
      listRepository,
      itemRepository,
      watchRepository,
      collaboratorRepository,
      lists,
      access,
      tv,
      progress
    ),
    items: new MediaListItemService(
      itemRepository,
      collaboratorRepository,
      lists,
      access,
      notifications
    ),
    watches: new MediaListWatchService(
      watchRepository,
      itemRepository,
      lists,
      access,
      tv,
      progress
    ),
    collaborators: new MediaListCollaboratorService(
      collaboratorRepository,
      lists,
      access,
      notifications,
      userDirectory
    ),
  };
};

// Built once and reused, matching how the rest of the server treats its singletons.
let services: MediaListServices | undefined;

export const getMediaListServices = (): MediaListServices => {
  if (!services) {
    services = buildMediaListServices();
  }
  return services;
};
