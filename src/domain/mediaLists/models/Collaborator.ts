import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';

export type CollaboratorRole = 'write' | 'read';

export interface Collaborator {
  user: MediaListUser;
  role: CollaboratorRole;
  // Null once the person who sent the invitation is deleted.
  invitedBy: MediaListUser | null;
  createdAt: Date;
}
