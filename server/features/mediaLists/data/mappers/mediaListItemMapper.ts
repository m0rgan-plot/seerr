import { toOptionalUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import type MediaListItemRecord from '@server/features/mediaLists/data/orm/MediaListItemRecord';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';

// The owning list is passed in rather than read off the record, because most queries
// already know it and joining the list back in just to recover its id would be wasteful.
export const toMediaListItem = (
  record: MediaListItemRecord,
  listId: number
): MediaListItem => ({
  id: record.id,
  listId,
  tmdbId: record.tmdbId,
  mediaType: record.mediaType,
  position: record.position,
  status: record.media?.status ?? null,
  addedBy: toOptionalUserRef(record.addedBy),
  createdAt: record.createdAt,
});
