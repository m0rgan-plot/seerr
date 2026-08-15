import { MediaType } from '@server/constants/media';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import type {
  MediaSummary,
  MediaSummaryProvider,
} from '@server/features/mediaLists/domain/ports/MediaSummaryProvider';
import type { TvMetadataProvider } from '@server/features/mediaLists/domain/ports/TvMetadataProvider';
import type { MediaListCollaboratorRepository } from '@server/features/mediaLists/domain/repositories/MediaListCollaboratorRepository';
import type { MediaListItemRepository } from '@server/features/mediaLists/domain/repositories/MediaListItemRepository';
import type { MediaListRepository } from '@server/features/mediaLists/domain/repositories/MediaListRepository';
import type {
  EpisodeWatchRow,
  MediaListWatchRepository,
} from '@server/features/mediaLists/domain/repositories/MediaListWatchRepository';
import type { MediaListAccessPolicy } from '@server/features/mediaLists/domain/services/MediaListAccessPolicy';
import type { MediaListProgressCalculator } from '@server/features/mediaLists/domain/services/MediaListProgressCalculator';
import type { MediaListService } from '@server/features/mediaLists/domain/services/MediaListService';
import type { MediaListMembership } from '@server/features/mediaLists/domain/valueObjects/MediaListMembership';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';
import type {
  EpisodeRef,
  ShowProgress,
} from '@server/features/mediaLists/domain/valueObjects/WatchProgress';

export type MediaListItemFilter = 'all' | 'unseen' | 'inprogress' | 'seen';

export interface MediaListItemView {
  item: MediaListItem;
  // Title, art and year from TMDB. Null when TMDB no longer knows the title.
  summary: MediaSummary | null;
  // The requesting member's own state.
  watched: boolean;
  progress: ShowProgress | null;
  // Members who have finished the title, for the seen-by badges.
  seenByUserIds: number[];
}

export interface MediaListPreviewItem {
  tmdbId: number;
  mediaType: MediaListItem['mediaType'];
  // Null when TMDB has no art, or no longer knows the title.
  posterPath: string | null;
}

export interface MediaListSummary {
  list: MediaList;
  membership: MediaListMembership;
  itemCount: number;
  seenCount: number;
  previewItems: MediaListPreviewItem[];
}

// Enough to fill the poster strip on a shelf row without turning the index into a long
// run of TMDB lookups.
const PREVIEW_ITEM_COUNT = 7;

// Assembles what the list and detail screens read. Kept apart from the services that
// change things, because the rules for reading are only ever "who is allowed to look"
// plus arithmetic over watch records.
export class MediaListViewService {
  constructor(
    private readonly lists: MediaListRepository,
    private readonly items: MediaListItemRepository,
    private readonly watches: MediaListWatchRepository,
    private readonly collaborators: MediaListCollaboratorRepository,
    private readonly listService: MediaListService,
    private readonly access: MediaListAccessPolicy,
    private readonly tv: TvMetadataProvider,
    private readonly progress: MediaListProgressCalculator,
    private readonly summaries: MediaSummaryProvider
  ) {}

  public async summariesFor(userId: number): Promise<MediaListSummary[]> {
    const lists = await this.lists.findAccessibleTo(userId);

    return Promise.all(
      lists.map(async (list) => {
        const [items, membership] = await Promise.all([
          this.items.findByList(list.id),
          this.listService.membershipFor(list, userId),
        ]);

        const views = await this.buildViews(items, userId, {
          withSummaries: false,
          allSeasonCounts: false,
        });

        return {
          list,
          membership,
          itemCount: items.length,
          seenCount: views.filter((view) => view.watched).length,
          previewItems: await this.buildPreview(
            items.slice(0, PREVIEW_ITEM_COUNT)
          ),
        };
      })
    );
  }

  public async itemViewsFor(
    listId: number,
    userId: number,
    filter: MediaListItemFilter = 'all'
  ): Promise<MediaListItemView[]> {
    const list = await this.listService.requireList(listId);
    this.access.assertCan(
      await this.listService.membershipFor(list, userId),
      'viewList'
    );

    const items = await this.items.findByList(listId);
    const views = await this.buildViews(items, userId, {
      withSummaries: true,
      allSeasonCounts: true,
    });

    return views.filter((view) => this.matchesFilter(view, filter));
  }

  public async collaboratorsFor(listId: number): Promise<UserRef[]> {
    const collaborators = await this.collaborators.findByList(listId);
    return collaborators.map((collaborator) => collaborator.user);
  }

  private matchesFilter(
    view: MediaListItemView,
    filter: MediaListItemFilter
  ): boolean {
    switch (filter) {
      case 'seen':
        return view.watched;
      case 'unseen':
        return !view.watched && (view.progress?.watchedEpisodes ?? 0) === 0;
      case 'inprogress':
        return !view.watched && (view.progress?.watchedEpisodes ?? 0) > 0;
      default:
        return true;
    }
  }

  private async buildViews(
    items: MediaListItem[],
    userId: number,
    options: { withSummaries: boolean; allSeasonCounts: boolean }
  ): Promise<MediaListItemView[]> {
    if (items.length === 0) {
      return [];
    }

    const itemIds = items.map((item) => item.id);
    const [movieWatches, episodeWatches] = await Promise.all([
      this.watches.findMovieWatchesForItems(itemIds),
      this.watches.findEpisodeWatchesForItems(itemIds),
    ]);

    const moviesByItem = new Map<number, Set<number>>();
    movieWatches.forEach((row) => {
      const users = moviesByItem.get(row.itemId) ?? new Set<number>();
      users.add(row.userId);
      moviesByItem.set(row.itemId, users);
    });

    const episodesByItem = this.groupEpisodes(episodeWatches);

    // Only shows somebody has actually started need their episode counts, which keeps a
    // list of untouched series from turning into a TMDB call each.
    const seasonCounts = await this.loadSeasonCounts(
      items,
      episodesByItem,
      options.allSeasonCounts
    );
    const summaries = options.withSummaries
      ? await this.loadSummaries(items)
      : new Map<number, MediaSummary | null>();

    return items.map((item) => {
      const watchers = moviesByItem.get(item.id) ?? new Set<number>();
      const byUser =
        episodesByItem.get(item.id) ?? new Map<number, EpisodeRef[]>();

      const summary = summaries.get(item.id) ?? null;

      if (item.mediaType === MediaType.MOVIE) {
        return {
          item,
          summary,
          watched: watchers.has(userId),
          progress: null,
          seenByUserIds: [...watchers],
        };
      }

      const counts = seasonCounts.get(item.tmdbId) ?? [];
      const mine = byUser.get(userId) ?? [];
      const progress = this.progress.showProgress(counts, mine);

      const seenByUserIds = [...byUser.entries()]
        .filter(([, episodes]) =>
          this.progress.hasFinishedShow(counts, episodes)
        )
        .map(([watcherId]) => watcherId);

      return {
        item,
        summary,
        watched: progress.isComplete,
        progress,
        seenByUserIds,
      };
    });
  }

  private groupEpisodes(
    rows: EpisodeWatchRow[]
  ): Map<number, Map<number, EpisodeRef[]>> {
    const byItem = new Map<number, Map<number, EpisodeRef[]>>();

    rows.forEach((row) => {
      const byUser = byItem.get(row.itemId) ?? new Map<number, EpisodeRef[]>();
      const episodes = byUser.get(row.userId) ?? [];
      episodes.push({
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
      });
      byUser.set(row.userId, episodes);
      byItem.set(row.itemId, byUser);
    });

    return byItem;
  }

  private async buildPreview(
    items: MediaListItem[]
  ): Promise<MediaListPreviewItem[]> {
    return Promise.all(
      items.map(async (item) => ({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        posterPath:
          (await this.summaries.getSummary(item.tmdbId, item.mediaType))
            ?.posterPath ?? null,
      }))
    );
  }

  private async loadSummaries(items: MediaListItem[]) {
    const entries = await Promise.all(
      items.map(
        async (item) =>
          [
            item.id,
            await this.summaries.getSummary(item.tmdbId, item.mediaType),
          ] as const
      )
    );

    return new Map(entries);
  }

  private async loadSeasonCounts(
    items: MediaListItem[],
    episodesByItem: Map<number, Map<number, EpisodeRef[]>>,
    includeUnstarted: boolean
  ) {
    // A series nobody has started cannot be complete, so the index skips its episode
    // counts entirely. The detail page asks for all of them, because a progress ring
    // reading 0/0 instead of 0/20 is worse than the extra cached lookup.
    const wanted = items.filter(
      (item) =>
        item.mediaType === MediaType.TV &&
        (includeUnstarted || episodesByItem.has(item.id))
    );
    const tmdbIds = [...new Set(wanted.map((item) => item.tmdbId))];

    const entries = await Promise.all(
      tmdbIds.map(
        async (tmdbId) =>
          [tmdbId, await this.tv.getSeasonEpisodeCounts(tmdbId)] as const
      )
    );

    return new Map(entries);
  }
}
