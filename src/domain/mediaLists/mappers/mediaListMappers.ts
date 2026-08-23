import type {
  MediaListCollaboratorDto,
  MediaListDto,
  MediaListInviteDto,
  MediaListItemDto,
  MediaListItemProgressDto,
  MediaListSummaryDto,
  MediaListUserDto,
} from '@app/domain/mediaLists/api/dto';
import type { Collaborator } from '@app/domain/mediaLists/models/Collaborator';
import type { WatchlistInvite } from '@app/domain/mediaLists/models/Invite';
import type {
  MediaList,
  MediaListSummary,
  MediaListUser,
} from '@app/domain/mediaLists/models/MediaList';
import type {
  ItemProgress,
  MediaListItem,
} from '@app/domain/mediaLists/models/MediaListItem';

// The seam between the wire and the rest of the app. Dates are parsed once here so no
// component ever handles an ISO string, and a field the API stops sending fails at this
// boundary rather than somewhere in a render.

const toUser = (dto: MediaListUserDto): MediaListUser => ({
  id: dto.id,
  displayName: dto.displayName,
  avatar: dto.avatar,
});

const toOptionalUser = (dto: MediaListUserDto | null): MediaListUser | null =>
  dto ? toUser(dto) : null;

export const toMediaList = (dto: MediaListDto): MediaList => ({
  id: dto.id,
  name: dto.name,
  description: dto.description,
  owner: toUser(dto.owner),
  role: dto.role,
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

export const toMediaListSummary = (
  dto: MediaListSummaryDto
): MediaListSummary => ({
  ...toMediaList(dto),
  itemCount: dto.itemCount,
  seenCount: dto.seenCount,
  previewItems: dto.previewItems.map((item) => ({
    id: item.id,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    posterPath: item.posterPath,
    watched: item.watched,
    status: item.status,
  })),
  sharedWith: dto.sharedWith.map(toUser),
  sharedWithCount: dto.sharedWithCount,
});

export const toMediaListItem = (dto: MediaListItemDto): MediaListItem => ({
  id: dto.id,
  listId: dto.listId,
  tmdbId: dto.tmdbId,
  mediaType: dto.mediaType,
  title: dto.title,
  posterPath: dto.posterPath,
  year: dto.year,
  position: dto.position,
  status: dto.status,
  addedBy: toOptionalUser(dto.addedBy),
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
  watched: dto.watched,
  progress: dto.progress
    ? {
        seasons: dto.progress.seasons.map((season) => ({ ...season })),
        watchedEpisodes: dto.progress.watchedEpisodes,
        totalEpisodes: dto.progress.totalEpisodes,
        isComplete: dto.progress.isComplete,
      }
    : null,
  seenBy: dto.seenBy.map(toUser),
});

export const toItemProgress = (
  dto: MediaListItemProgressDto
): ItemProgress => ({
  progress: {
    seasons: dto.progress.seasons.map((season) => ({ ...season })),
    watchedEpisodes: dto.progress.watchedEpisodes,
    totalEpisodes: dto.progress.totalEpisodes,
    isComplete: dto.progress.isComplete,
  },
  episodes: dto.episodes.map((episode) => ({
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
  })),
});

export const toCollaborator = (
  dto: MediaListCollaboratorDto
): Collaborator => ({
  user: toUser(dto.user),
  role: dto.role,
  status: dto.status,
  invitedBy: toOptionalUser(dto.invitedBy),
  createdAt: new Date(dto.createdAt),
});

export const toWatchlistInvite = (
  dto: MediaListInviteDto
): WatchlistInvite => ({
  listId: dto.listId,
  listName: dto.listName,
  role: dto.role,
  invitedBy: toOptionalUser(dto.invitedBy),
  itemCount: dto.itemCount,
  createdAt: new Date(dto.createdAt),
});
