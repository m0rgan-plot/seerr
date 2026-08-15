import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type {
  MediaListItemView,
  MediaListSummary,
} from '@server/features/mediaLists/domain/services/MediaListViewService';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { MediaListMembership } from '@server/features/mediaLists/domain/valueObjects/MediaListMembership';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import type {
  MediaListCollaborator as MediaListCollaboratorDto,
  MediaList as MediaListDto,
  MediaListItem as MediaListItemDto,
  MediaListRole,
  MediaListSummary as MediaListSummaryDto,
  MediaListUser,
} from '@server/interfaces/api/mediaListInterfaces';

// UserRef already carries only what is safe to publish, so the response mapper has no
// filtering left to do. Anything sensitive was dropped back at the data layer.
const toUser = (user: UserRef): MediaListUser => ({
  id: user.id,
  displayName: user.displayName,
  avatar: user.avatar,
});

const toOptionalUser = (user: UserRef | null): MediaListUser | null =>
  user ? toUser(user) : null;

export const toRole = (membership: MediaListMembership): MediaListRole => {
  if (membership.kind === 'owner') {
    return 'owner';
  }
  if (membership.kind === 'collaborator') {
    return membership.role === CollaboratorRole.WRITE ? 'write' : 'read';
  }
  // Routes reject a caller with no membership before reaching the mapper, so the
  // narrowest role is the safe way to satisfy the type.
  return 'read';
};

export const toMediaListDto = (
  list: MediaList,
  membership: MediaListMembership
): MediaListDto => ({
  id: list.id,
  name: list.name,
  description: list.description,
  owner: toUser(list.owner),
  role: toRole(membership),
  createdAt: list.createdAt.toISOString(),
  updatedAt: list.updatedAt.toISOString(),
});

export const toMediaListSummaryDto = (
  summary: MediaListSummary
): MediaListSummaryDto => ({
  ...toMediaListDto(summary.list, summary.membership),
  itemCount: summary.itemCount,
  seenCount: summary.seenCount,
  previewItems: summary.previewItems.map((item) => ({
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    posterPath: item.posterPath,
  })),
});

export const toMediaListItemDto = (
  view: MediaListItemView,
  seenBy: UserRef[]
): MediaListItemDto => ({
  id: view.item.id,
  listId: view.item.listId,
  tmdbId: view.item.tmdbId,
  mediaType: view.item.mediaType,
  title: view.summary?.title ?? null,
  posterPath: view.summary?.posterPath ?? null,
  year: view.summary?.year ?? null,
  position: view.item.position,
  addedBy: toOptionalUser(view.item.addedBy),
  createdAt: view.item.createdAt.toISOString(),
  watched: view.watched,
  progress: view.progress,
  seenBy: seenBy.map(toUser),
});

export const toCollaboratorDto = (
  collaborator: Collaborator
): MediaListCollaboratorDto => ({
  user: toUser(collaborator.user),
  role: collaborator.role === CollaboratorRole.WRITE ? 'write' : 'read',
  invitedBy: toOptionalUser(collaborator.invitedBy),
  createdAt: collaborator.createdAt.toISOString(),
});
