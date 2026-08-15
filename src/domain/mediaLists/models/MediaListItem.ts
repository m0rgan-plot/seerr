import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';
import type { MediaType } from '@server/constants/media';

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
  // Null once the person who added it is deleted. The title stays on the list.
  addedBy: MediaListUser | null;
  createdAt: Date;
  // The signed-in member's own state. Progress is null for movies.
  watched: boolean;
  progress: ShowProgress | null;
  // Other members who have finished it, for the seen-by badges.
  seenBy: MediaListUser[];
}

export type MediaListItemFilter = 'all' | 'unseen' | 'inprogress' | 'seen';

export const isSeries = (item: MediaListItem): boolean => !!item.progress;

// Started but not finished, which is what the "In progress" filter chip counts.
export const isInProgress = (item: MediaListItem): boolean =>
  !item.watched && (item.progress?.watchedEpisodes ?? 0) > 0;
