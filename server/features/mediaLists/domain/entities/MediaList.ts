import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

export interface MediaList {
  id: number;
  name: string;
  description: string | null;
  owner: UserRef;
  createdAt: Date;
  updatedAt: Date;
}
