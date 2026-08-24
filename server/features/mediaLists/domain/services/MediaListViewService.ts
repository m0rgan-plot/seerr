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
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
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
  id: number;
  tmdbId: number;
  mediaType: MediaListItem['mediaType'];
  // Null when TMDB no longer knows the title.
  title: string | null;
  // Null when TMDB has no art, or no longer knows the title.
  posterPath: string | null;
  // The requesting member's own state, so the poster strip can offer the right CTA.
  watched: boolean;
  // Availability in the library, which is what decides between offering a request and
  // reporting one already in flight.
  status: MediaListItem['status'];
  createdAt: Date;
  addedBy: UserRef | null;
}

export interface MediaListSummary {
  list: MediaList;
  membership: MediaListMembership;
  itemCount: number;
  seenCount: number;
  previewItems: MediaListPreviewItem[];
  // Everyone the list is shared with, for the shelf row's avatar badges. Full set here;
  // the presentation mapper decides how much of it is worth putting on the wire.
  sharedWith: UserRef[];
}

export interface MediaListInviteView {
  list: MediaList;
  role: CollaboratorRole;
  invitedBy: UserRef | null;
  createdAt: Date;
  // A count only, never the items themselves: the invite card lets someone decide
  // whether to accept without first being shown the list's contents.
  itemCount: number;
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

    // One query for every list's collaborators, keyed by list id, instead of one per
    // list inside the map below — that would turn N lists into N more queries on top
    // of the index's already-documented N+1.
    const collaboratorsByList = await this.collaborators.findByLists(
      lists.map((list) => list.id)
    );

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

        // findByList orders by position ascending; the preview reads as "what's new on
        // this list", so it takes the highest positions instead. Manual drag-reorder
        // was never built (see WATCHLISTS_STATUS.md), so position is still exactly an
        // insertion counter today -- a more reliable "most recent" signal than a
        // timestamp column, which two adds in the same request could tie on.
        const byRecency = [...views].sort(
          (a, b) => b.item.position - a.item.position
        );

        return {
          list,
          membership,
          itemCount: items.length,
          seenCount: views.filter((view) => view.watched).length,
          previewItems: await this.buildPreview(
            byRecency.slice(0, PREVIEW_ITEM_COUNT)
          ),
          // Owner first, then accepted collaborators -- same "everyone with access"
          // shape sharedWithFor uses for the detail page, so a collaborator sees the
          // owner here too. The viewer's own face (owner or collaborator) is filtered
          // out client-side by WatchlistSharedWithAvatars, not here.
          sharedWith: [
            list.owner,
            ...(collaboratorsByList.get(list.id) ?? []).map(
              (collaborator) => collaborator.user
            ),
          ],
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

  // Everyone whose watch state can show up on the list. The owner is deliberately not a
  // collaborator row, so asking the collaborator table alone would drop the seen-by
  // badge of the person who created the list.
  public async membersFor(listId: number): Promise<UserRef[]> {
    const [list, collaborators] = await Promise.all([
      this.listService.requireList(listId),
      this.collaborators.findByList(listId),
    ]);

    return [
      list.owner,
      ...collaborators.map((collaborator) => collaborator.user),
    ];
  }

  // Everyone with access to a single list -- owner plus accepted collaborators, never a
  // pending invitee who has not joined yet -- for the detail page's "who's here" avatar
  // row. Unlike membersFor, this is accepted-only: the same rule the index's batched
  // lookup applies, reused here via a one-element list rather than a second query path.
  public async sharedWithFor(listId: number): Promise<UserRef[]> {
    const [list, byList] = await Promise.all([
      this.listService.requireList(listId),
      this.collaborators.findByLists([listId]),
    ]);

    return [
      list.owner,
      ...(byList.get(listId) ?? []).map((collaborator) => collaborator.user),
    ];
  }

  // Every pending invite for the signed-in user, with an item count per list so the
  // Invites section can show something more than a bare name without touching the
  // items themselves.
  public async invitesFor(userId: number): Promise<MediaListInviteView[]> {
    const invites = await this.collaborators.findPendingInvitesFor(userId);

    return Promise.all(
      invites.map(async (invite) => ({
        list: invite.list,
        role: invite.role,
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
        itemCount: (await this.items.findByList(invite.list.id)).length,
      }))
    );
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
    views: MediaListItemView[]
  ): Promise<MediaListPreviewItem[]> {
    return Promise.all(
      views.map(async (view) => {
        const summary = await this.summaries.getSummary(
          view.item.tmdbId,
          view.item.mediaType
        );

        return {
          id: view.item.id,
          tmdbId: view.item.tmdbId,
          mediaType: view.item.mediaType,
          title: summary?.title ?? null,
          watched: view.watched,
          status: view.item.status,
          posterPath: summary?.posterPath ?? null,
          createdAt: view.item.createdAt,
          addedBy: view.item.addedBy,
        };
      })
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
