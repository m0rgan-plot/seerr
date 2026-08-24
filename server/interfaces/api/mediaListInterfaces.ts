import type { MediaType } from '@server/constants/media';

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
  // Relative TMDB path, or null when there is no art. Clients build the full URL the
  // same way they do everywhere else.
  posterPath: string | null;
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
  addedBy: MediaListUser | null;
  createdAt: string;
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

export interface MediaListCollaborator {
  user: MediaListUser;
  role: Exclude<MediaListRole, 'owner'>;
  invitedBy: MediaListUser | null;
  createdAt: string;
}

export type MediaListsResponse = MediaListSummary[];
export type MediaListItemsResponse = MediaListItem[];
export type MediaListCollaboratorsResponse = MediaListCollaborator[];
