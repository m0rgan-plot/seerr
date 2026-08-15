import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

// Lets the sharing use case resolve who it is inviting without the presentation layer
// reaching into persistence, which is what keeps the permission check ahead of the
// lookup rather than behind it.
export interface UserDirectory {
  findById(userId: number): Promise<UserRef | null>;
}
