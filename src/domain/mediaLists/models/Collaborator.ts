import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';

export type CollaboratorRole = 'write' | 'read';
export type InviteStatus = 'pending' | 'accepted';

export interface Collaborator {
  user: MediaListUser;
  role: CollaboratorRole;
  status: InviteStatus;
  // Null once the person who sent the invitation is deleted.
  invitedBy: MediaListUser | null;
  createdAt: Date;
}
