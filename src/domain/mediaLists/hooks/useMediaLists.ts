import type {
  MediaListCollaboratorDto,
  MediaListDto,
  MediaListInviteDto,
  MediaListItemDto,
  MediaListItemProgressDto,
  MediaListMembershipDto,
  MediaListSummaryDto,
} from '@app/domain/mediaLists/api/dto';
import {
  collaboratorsKey,
  invitesKey,
  itemsKey,
  listKey,
  mediaListsKey,
  membershipKey,
  progressKey,
} from '@app/domain/mediaLists/api/mediaListsApi';
import {
  toCollaborator,
  toItemProgress,
  toMediaList,
  toMediaListItem,
  toMediaListSummary,
  toWatchlistInvite,
} from '@app/domain/mediaLists/mappers/mediaListMappers';
import type { Collaborator } from '@app/domain/mediaLists/models/Collaborator';
import type { WatchlistInvite } from '@app/domain/mediaLists/models/Invite';
import type {
  MediaList,
  MediaListSummary,
} from '@app/domain/mediaLists/models/MediaList';
import type {
  ItemProgress,
  MediaListItem,
  MediaListItemFilter,
} from '@app/domain/mediaLists/models/MediaListItem';
import type { MediaType } from '@server/constants/media';
import { useMemo } from 'react';
import useSWR from 'swr';

// Each hook maps the wire shape into domain models before anything renders, so components
// never see a DTO. The global SWR fetcher already does the GET, so no fetcher is passed.

interface Query<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  revalidate: () => void;
}

export const useMediaLists = (): Query<MediaListSummary[]> => {
  const { data, error, mutate } = useSWR<MediaListSummaryDto[]>(mediaListsKey);

  return {
    data: useMemo(() => data?.map(toMediaListSummary), [data]),
    error,
    isLoading: !data && !error,
    revalidate: () => {
      mutate();
    },
  };
};

export const useMediaList = (
  mediaListId: number | undefined
): Query<MediaList> => {
  const { data, error, mutate } = useSWR<MediaListDto>(
    mediaListId ? listKey(mediaListId) : null
  );

  return {
    data: useMemo(() => (data ? toMediaList(data) : undefined), [data]),
    error,
    isLoading: !!mediaListId && !data && !error,
    revalidate: () => {
      mutate();
    },
  };
};

// Which of the signed-in member's own lists (owned or shared with them) already hold
// this title, mapped to the item id on each, so the media page's Add to Watchlist
// button can show a list as already added -- and remove it again -- without a click
// first.
export const useMediaListMembership = (
  tmdbId: number,
  mediaType: MediaType
): Query<Map<number, number>> => {
  const { data, error, mutate } = useSWR<MediaListMembershipDto>(
    membershipKey(tmdbId, mediaType)
  );

  return {
    data: useMemo(
      () =>
        data
          ? new Map(data.items.map(({ listId, itemId }) => [listId, itemId]))
          : undefined,
      [data]
    ),
    error,
    isLoading: !data && !error,
    revalidate: () => {
      mutate();
    },
  };
};

export const useMediaListItems = (
  mediaListId: number | undefined,
  filter: MediaListItemFilter = 'all'
): Query<MediaListItem[]> => {
  const { data, error, mutate } = useSWR<MediaListItemDto[]>(
    mediaListId ? itemsKey(mediaListId, filter) : null
  );

  return {
    data: useMemo(() => data?.map(toMediaListItem), [data]),
    error,
    isLoading: !!mediaListId && !data && !error,
    revalidate: () => {
      mutate();
    },
  };
};

export const useItemProgress = (
  mediaListId: number | undefined,
  itemId: number | undefined,
  // Only series track progress, and only an open accordion needs it.
  enabled = true
): Query<ItemProgress> => {
  const { data, error, mutate } = useSWR<MediaListItemProgressDto>(
    enabled && mediaListId && itemId ? progressKey(mediaListId, itemId) : null
  );

  return {
    data: useMemo(() => (data ? toItemProgress(data) : undefined), [data]),
    error,
    isLoading: enabled && !!mediaListId && !!itemId && !data && !error,
    revalidate: () => {
      mutate();
    },
  };
};

export const useWatchlistInvites = (): Query<WatchlistInvite[]> => {
  const { data, error, mutate } = useSWR<MediaListInviteDto[]>(invitesKey);

  return {
    data: useMemo(() => data?.map(toWatchlistInvite), [data]),
    error,
    isLoading: !data && !error,
    revalidate: () => {
      mutate();
    },
  };
};

export const useMediaListCollaborators = (
  mediaListId: number | undefined
): Query<Collaborator[]> => {
  const { data, error, mutate } = useSWR<MediaListCollaboratorDto[]>(
    mediaListId ? collaboratorsKey(mediaListId) : null
  );

  return {
    data: useMemo(() => data?.map(toCollaborator), [data]),
    error,
    isLoading: !!mediaListId && !data && !error,
    revalidate: () => {
      mutate();
    },
  };
};
