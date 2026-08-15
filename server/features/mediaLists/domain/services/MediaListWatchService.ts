import { MediaType } from '@server/constants/media';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import {
  InvalidWatchTargetError,
  ItemNotFoundInListError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import type { TvMetadataProvider } from '@server/features/mediaLists/domain/ports/TvMetadataProvider';
import type { MediaListItemRepository } from '@server/features/mediaLists/domain/repositories/MediaListItemRepository';
import type { MediaListWatchRepository } from '@server/features/mediaLists/domain/repositories/MediaListWatchRepository';
import type {
  EpisodeRef,
  ShowProgress,
} from '@server/features/mediaLists/domain/valueObjects/WatchProgress';
import type { MediaListAccessPolicy } from './MediaListAccessPolicy';
import type { MediaListProgressCalculator } from './MediaListProgressCalculator';
import type { MediaListService } from './MediaListService';

// The derived rollup plus the episodes it was derived from. The checklist needs to know
// which boxes are ticked, not just how many. Deliberately not called watchedEpisodes:
// ShowProgress already uses that name for the count, and one of them would read wrong.
export interface MediaListItemProgress {
  progress: ShowProgress;
  episodes: EpisodeRef[];
}

// Every method here writes only the caller's own state, which is why read-only
// collaborators are allowed through: tracking what you watched is not editing the list.
export class MediaListWatchService {
  constructor(
    private readonly watches: MediaListWatchRepository,
    private readonly items: MediaListItemRepository,
    private readonly listService: MediaListService,
    private readonly access: MediaListAccessPolicy,
    private readonly tv: TvMetadataProvider,
    private readonly progress: MediaListProgressCalculator
  ) {}

  private async requireTrackableItem(
    listId: number,
    itemId: number,
    userId: number
  ): Promise<MediaListItem> {
    const list = await this.listService.requireList(listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, userId),
      'trackOwnProgress'
    );

    const item = await this.items.findById(itemId);
    if (!item || item.listId !== listId) {
      throw new ItemNotFoundInListError();
    }
    return item;
  }

  public async setMovieWatched(
    listId: number,
    itemId: number,
    userId: number,
    watched: boolean
  ): Promise<void> {
    const item = await this.requireTrackableItem(listId, itemId, userId);
    if (item.mediaType !== MediaType.MOVIE) {
      throw new InvalidWatchTargetError(
        'Series track progress per episode, not as a single title'
      );
    }

    if (watched) {
      await this.watches.setMovieWatched(itemId, userId);
    } else {
      await this.watches.clearMovieWatched(itemId, userId);
    }
  }

  public async setEpisodeWatched(
    listId: number,
    itemId: number,
    userId: number,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean
  ): Promise<void> {
    const item = await this.requireTrackableItem(listId, itemId, userId);
    this.assertShow(item);

    const episodes = [{ seasonNumber, episodeNumber }];
    if (watched) {
      await this.watches.setEpisodesWatched(itemId, userId, episodes);
    } else {
      await this.watches.clearEpisodesWatched(itemId, userId, episodes);
    }
  }

  // Marking a season is a shortcut for ticking each of its episodes. There is no stored
  // season flag, so completion falls out of the episode records on the next read.
  public async setSeasonWatched(
    listId: number,
    itemId: number,
    userId: number,
    seasonNumber: number,
    watched: boolean
  ): Promise<void> {
    const item = await this.requireTrackableItem(listId, itemId, userId);
    this.assertShow(item);

    if (!watched) {
      await this.watches.clearSeasonWatched(itemId, userId, seasonNumber);
      return;
    }

    const episodeNumbers = await this.tv.getSeasonEpisodeNumbers(
      item.tmdbId,
      seasonNumber
    );
    if (episodeNumbers.length === 0) {
      return;
    }

    await this.watches.setEpisodesWatched(
      itemId,
      userId,
      episodeNumbers.map((episodeNumber) => ({ seasonNumber, episodeNumber }))
    );
  }

  public async progressFor(
    listId: number,
    itemId: number,
    userId: number
  ): Promise<MediaListItemProgress> {
    const item = await this.requireTrackableItem(listId, itemId, userId);
    this.assertShow(item);

    const [counts, watched] = await Promise.all([
      this.tv.getSeasonEpisodeCounts(item.tmdbId),
      this.watches.findWatchedEpisodes(itemId, userId),
    ]);

    return {
      progress: this.progress.showProgress(counts, watched),
      episodes: watched,
    };
  }

  private assertShow(item: MediaListItem): void {
    if (item.mediaType !== MediaType.TV) {
      throw new InvalidWatchTargetError(
        'Only series track progress per episode'
      );
    }
  }
}
