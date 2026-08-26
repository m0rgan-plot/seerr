import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';

export interface CreateMediaListInput {
  name: string;
  description: string | null;
  ownerId: number;
}

export interface UpdateMediaListInput {
  name?: string;
  description?: string | null;
}

export interface MediaListRepository {
  findById(id: number): Promise<MediaList | null>;
  // Lists the user owns plus lists shared with them, newest first.
  findAccessibleTo(userId: number): Promise<MediaList[]>;
  create(input: CreateMediaListInput): Promise<MediaList>;
  update(id: number, changes: UpdateMediaListInput): Promise<MediaList>;
  delete(id: number): Promise<void>;
  // Bumps updatedAt alone, for actions (adding/removing items) that change what the
  // list holds without going through update()'s name/description fields.
  touch(id: number): Promise<void>;
}
