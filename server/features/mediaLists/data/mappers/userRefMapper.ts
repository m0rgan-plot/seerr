import type { User } from '@server/entity/User';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

// Narrowing a User to a UserRef is what keeps email, tokens and password hashes from
// travelling with a list. Everything above the data layer only ever sees these fields.
export const toUserRef = (user: User): UserRef => ({
  id: user.id,
  // displayName is normally filled in by the entity's AfterLoad hook. The fallback keeps
  // a freshly constructed user from mapping to an empty name.
  displayName:
    user.displayName ||
    user.username ||
    user.plexUsername ||
    user.jellyfinUsername ||
    user.email,
  avatar: user.avatar,
});

export const toOptionalUserRef = (user?: User | null): UserRef | null =>
  user ? toUserRef(user) : null;
