import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';
import type { MediaStatus } from '@server/constants/media';
import { MediaType } from '@server/constants/media';

export interface SeasonProgress {
  seasonNumber: number;
  watchedEpisodes: number;
  totalEpisodes: number;
  isComplete: boolean;
}

export interface ShowProgress {
  seasons: SeasonProgress[];
  watchedEpisodes: number;
  totalEpisodes: number;
  isComplete: boolean;
}

export interface MediaListItem {
  id: number;
  listId: number;
  tmdbId: number;
  mediaType: MediaType;
  // Resolved from TMDB with the list. Null when TMDB no longer knows the title.
  title: string | null;
  posterPath: string | null;
  year: number | null;
  position: number;
  // Availability in the library, which is what tells a request apart from a re-request.
  // Nothing to do with watched, which is per member.
  status: MediaStatus | null;
  // Null once the person who added it is deleted. The title stays on the list.
  addedBy: MediaListUser | null;
  // When the title was pinned, or null when it isn't. Shared across every member: a
  // pinned title leads the list and the shelf strip regardless of who pinned it.
  pinnedAt: Date | null;
  createdAt: Date;
  // Bumped only by adding the item or reordering the list, never by watched state.
  // What the "recently added" default sort orders on.
  updatedAt: Date;
  // The signed-in member's own state. Progress is null for movies.
  watched: boolean;
  progress: ShowProgress | null;
  // Other members who have finished it, for the seen-by badges.
  seenBy: MediaListUser[];
}

export interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

export interface ItemProgress {
  progress: ShowProgress;
  // Which episodes the signed-in member has ticked.
  episodes: EpisodeRef[];
}

export const episodeKey = ({ seasonNumber, episodeNumber }: EpisodeRef) =>
  `${seasonNumber}:${episodeNumber}`;

export type MediaListItemFilter = 'all' | 'unseen' | 'inprogress' | 'seen';

// The media type is the authority here. Progress happens to be present for every series
// the API returns today, but a series TMDB cannot resolve would read as a movie.
export const isSeries = (item: MediaListItem): boolean =>
  item.mediaType === MediaType.TV;

// Started but not finished, which is what the "In progress" filter chip counts.
export const isInProgress = (item: MediaListItem): boolean =>
  !item.watched && (item.progress?.watchedEpisodes ?? 0) > 0;

export const isPinned = (item: MediaListItem): boolean =>
  item.pinnedAt !== null;
