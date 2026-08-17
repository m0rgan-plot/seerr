import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type {
  MediaListInviteView,
  MediaListItemView,
  MediaListSummary,
} from '@server/features/mediaLists/domain/services/MediaListViewService';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import type { MediaListMembership } from '@server/features/mediaLists/domain/valueObjects/MediaListMembership';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import type {
  MediaListCollaborator as MediaListCollaboratorDto,
  MediaList as MediaListDto,
  MediaListInvite as MediaListInviteDto,
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

// The index sends this on every list, not just one, so the wire payload is capped to a
// handful of avatars; sharedWithCount carries the true total for the "+N" overflow badge.
const SHARED_WITH_LIMIT = 5;

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
    id: item.id,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    title: item.title,
    posterPath: item.posterPath,
    watched: item.watched,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    addedBy: toOptionalUser(item.addedBy),
  })),
  sharedWith: summary.sharedWith.slice(0, SHARED_WITH_LIMIT).map(toUser),
  sharedWithCount: summary.sharedWith.length,
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
  status: view.item.status,
  addedBy: toOptionalUser(view.item.addedBy),
  createdAt: view.item.createdAt.toISOString(),
  updatedAt: view.item.updatedAt.toISOString(),
  watched: view.watched,
  progress: view.progress,
  seenBy: seenBy.map(toUser),
});

export const toCollaboratorDto = (
  collaborator: Collaborator
): MediaListCollaboratorDto => ({
  user: toUser(collaborator.user),
  role: collaborator.role === CollaboratorRole.WRITE ? 'write' : 'read',
  status: collaborator.status,
  invitedBy: toOptionalUser(collaborator.invitedBy),
  createdAt: collaborator.createdAt.toISOString(),
});

export const toMediaListInviteDto = (
  invite: MediaListInviteView
): MediaListInviteDto => ({
  listId: invite.list.id,
  listName: invite.list.name,
  role: invite.role === CollaboratorRole.WRITE ? 'write' : 'read',
  invitedBy: toOptionalUser(invite.invitedBy),
  itemCount: invite.itemCount,
  createdAt: invite.createdAt.toISOString(),
});
