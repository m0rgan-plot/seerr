import { toUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import type MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';

export const toMediaList = (record: MediaListRecord): MediaList => ({
  id: record.id,
  name: record.name,
  description: record.description ?? null,
  owner: toUserRef(record.owner),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
