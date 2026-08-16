import type { MediaStatus, MediaType } from '@server/constants/media';

// What components work with. Distinct from the wire shape: dates arrive as strings and
// are parsed once here, so no component has to think about it.

export type MediaListRole = 'owner' | 'write' | 'read';

export interface MediaListUser {
  id: number;
  displayName: string;
  avatar: string;
}

export interface MediaListRef {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  // Relative TMDB path, or null when there is no art for the title.
  posterPath: string | null;
  // The signed-in member's own state, so hover CTAs know which action to offer.
  watched: boolean;
  // Availability in the library, which decides what the request CTA says.
  status: MediaStatus | null;
}

export interface MediaList {
  id: number;
  name: string;
  description: string | null;
  owner: MediaListUser;
  role: MediaListRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaListSummary extends MediaList {
  itemCount: number;
  // Titles the signed-in member has finished, not a shared total.
  seenCount: number;
  previewItems: MediaListRef[];
}

// UX gating only. Every mutation is checked again on the server, so these are about not
// showing a control that would fail rather than about enforcing anything.
export const canEditItems = (role: MediaListRole): boolean => role !== 'read';

export const canManageCollaborators = (role: MediaListRole): boolean =>
  role === 'owner';

export const canDeleteList = (role: MediaListRole): boolean => role === 'owner';

// Anyone with access records their own watched state, including read-only members.
export const canTrackOwnProgress = (): boolean => true;

export const isSharedWithMe = (list: MediaList): boolean =>
  list.role !== 'owner';
