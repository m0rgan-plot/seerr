import type { MediaStatus, MediaType } from '@server/constants/media';

// Wire shapes for /api/v1/mediaLists. Defined once and imported by both the response
// mapper and the frontend, so the two cannot drift apart.

export type MediaListRole = 'owner' | 'write' | 'read';

export interface MediaListUser {
  id: number;
  displayName: string;
  avatar: string;
}

export interface MediaListItemRef {
  tmdbId: number;
  mediaType: MediaType;
}

export interface MediaListPreviewItem extends MediaListItemRef {
  id: number;
  // Relative TMDB path, or null when there is no art. Clients build the full URL the
  // same way they do everywhere else.
  posterPath: string | null;
  // The requesting member's own state, so the poster strip can offer the right CTA.
  watched: boolean;
  // Where the title stands in the library. Null when nothing has ever tracked it.
  status: MediaStatus | null;
}

export interface MediaListSeasonProgress {
  seasonNumber: number;
  watchedEpisodes: number;
  totalEpisodes: number;
  isComplete: boolean;
}

export interface MediaListShowProgress {
  seasons: MediaListSeasonProgress[];
  watchedEpisodes: number;
  totalEpisodes: number;
  isComplete: boolean;
}

export interface MediaList {
  id: number;
  name: string;
  description: string | null;
  owner: MediaListUser;
  role: MediaListRole;
  createdAt: string;
  updatedAt: string;
}

export interface MediaListSummary extends MediaList {
  itemCount: number;
  // How many titles the requesting member has finished, not a shared total.
  seenCount: number;
  previewItems: MediaListPreviewItem[];
}

export interface MediaListItem {
  id: number;
  listId: number;
  tmdbId: number;
  mediaType: MediaType;
  // Resolved from TMDB alongside the list. Null when TMDB no longer knows the title.
  title: string | null;
  posterPath: string | null;
  year: number | null;
  position: number;
  // Availability in the library, which decides whether the card offers a request or
  // reports one already in flight. Separate from watched, which is per member.
  status: MediaStatus | null;
  addedBy: MediaListUser | null;
  createdAt: string;
  updatedAt: string;
  // The requesting member's own state. Null progress means the title is a movie.
  watched: boolean;
  progress: MediaListShowProgress | null;
  // Other members who have finished it, for the seen-by badges.
  seenBy: MediaListUser[];
}

export interface MediaListEpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

export interface MediaListItemProgress {
  progress: MediaListShowProgress;
  // Which episodes the requesting member has ticked, so the checklist can render.
  episodes: MediaListEpisodeRef[];
}

export type MediaListInviteStatus = 'pending' | 'accepted';

export interface MediaListCollaborator {
  user: MediaListUser;
  role: Exclude<MediaListRole, 'owner'>;
  status: MediaListInviteStatus;
  invitedBy: MediaListUser | null;
  createdAt: string;
}

// A pending invite as seen by the invited user. Carries an item count but never the
// items themselves, so accepting or rejecting is never a decision made on list contents.
export interface MediaListInvite {
  listId: number;
  listName: string;
  role: Exclude<MediaListRole, 'owner'>;
  invitedBy: MediaListUser | null;
  itemCount: number;
  createdAt: string;
}

export type MediaListsResponse = MediaListSummary[];
export type MediaListItemsResponse = MediaListItem[];
export type MediaListCollaboratorsResponse = MediaListCollaborator[];
export type MediaListInvitesResponse = MediaListInvite[];
