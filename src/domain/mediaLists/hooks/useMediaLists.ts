import type {
  MediaListCollaboratorDto,
  MediaListDto,
  MediaListItemDto,
  MediaListSummaryDto,
} from '@app/domain/mediaLists/api/dto';
import {
  collaboratorsKey,
  itemsKey,
  listKey,
  mediaListsKey,
} from '@app/domain/mediaLists/api/mediaListsApi';
import {
  toCollaborator,
  toMediaList,
  toMediaListItem,
  toMediaListSummary,
} from '@app/domain/mediaLists/mappers/mediaListMappers';
import type { Collaborator } from '@app/domain/mediaLists/models/Collaborator';
import type {
  MediaList,
  MediaListSummary,
} from '@app/domain/mediaLists/models/MediaList';
import type {
  MediaListItem,
  MediaListItemFilter,
} from '@app/domain/mediaLists/models/MediaListItem';
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
