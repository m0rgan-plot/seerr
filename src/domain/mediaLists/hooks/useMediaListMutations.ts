import * as api from '@app/domain/mediaLists/api/mediaListsApi';
import {
  toCollaborator,
  toMediaList,
  toMediaListItem,
} from '@app/domain/mediaLists/mappers/mediaListMappers';
import type {
  Collaborator,
  CollaboratorRole,
} from '@app/domain/mediaLists/models/Collaborator';
import type { MediaList } from '@app/domain/mediaLists/models/MediaList';
import type { MediaListItem } from '@app/domain/mediaLists/models/MediaListItem';
import type { MediaType } from '@server/constants/media';
import { useCallback } from 'react';
import { mutate } from 'swr';

// Every call refreshes the keys the change actually affects and then rethrows, so the
// component that triggered it owns the success and failure copy. Keeping the messaging
// out of here is what stops this layer from needing i18n.
export const useMediaListMutations = (mediaListId?: number) => {
  const refreshIndex = useCallback(() => mutate(api.mediaListsKey), []);

  const refreshList = useCallback(
    (listId: number) =>
      Promise.all([
        mutate(api.listKey(listId)),
        // The items key varies by filter, so refresh every variant that is cached.
        // Passing data alongside the filter would make SWR write it: the third argument
        // takes it out of the revalidate-only path, and an undefined payload then blanks
        // the cache before the refetch lands, unmounting whatever is on screen.
        mutate(
          (key) =>
            typeof key === 'string' &&
            key.startsWith(`${api.listKey(listId)}/items`)
        ),
        mutate(api.mediaListsKey),
      ]),
    []
  );

  const refreshCollaborators = useCallback(
    (listId: number) =>
      Promise.all([
        mutate(api.collaboratorsKey(listId)),
        mutate(api.listKey(listId)),
      ]),
    []
  );

  const requireList = (listId?: number): number => {
    const resolved = listId ?? mediaListId;
    if (!resolved) {
      throw new Error('A watchlist id is required for this action');
    }
    return resolved;
  };

  return {
    createList: async (input: {
      name: string;
      description?: string | null;
    }): Promise<MediaList> => {
      const created = await api.createMediaList(input);
      await refreshIndex();
      return toMediaList(created);
    },

    updateList: async (
      changes: { name?: string; description?: string | null },
      listId?: number
    ): Promise<MediaList> => {
      const id = requireList(listId);
      const updated = await api.updateMediaList(id, changes);
      await refreshList(id);
      return toMediaList(updated);
    },

    deleteList: async (listId?: number): Promise<void> => {
      await api.deleteMediaList(requireList(listId));
      await refreshIndex();
    },

    addItem: async (
      input: { tmdbId: number; mediaType: MediaType },
      listId?: number
    ): Promise<MediaListItem> => {
      const id = requireList(listId);
      const added = await api.addMediaListItem(id, input);
      await refreshList(id);
      return toMediaListItem(added);
    },

    removeItem: async (itemId: number, listId?: number): Promise<void> => {
      const id = requireList(listId);
      await api.removeMediaListItem(id, itemId);
      await refreshList(id);
    },

    reorderItems: async (
      orderedItemIds: number[],
      listId?: number
    ): Promise<void> => {
      const id = requireList(listId);
      await api.reorderMediaListItems(id, orderedItemIds);
      await refreshList(id);
    },

    setMovieWatched: async (
      itemId: number,
      watched: boolean,
      listId?: number
    ): Promise<void> => {
      const id = requireList(listId);
      await api.setMovieWatched(id, itemId, watched);
      await refreshList(id);
    },

    setSeasonWatched: async (
      itemId: number,
      seasonNumber: number,
      watched: boolean,
      listId?: number
    ): Promise<void> => {
      const id = requireList(listId);
      await api.setSeasonWatched(id, itemId, seasonNumber, watched);
      await refreshList(id);
    },

    // Marking a whole show is one intent, so it refreshes once at the end rather than
    // after each season. The calls stay sequential because they write the same rows.
    setSeasonsWatched: async (
      itemId: number,
      seasonNumbers: number[],
      watched: boolean,
      listId?: number
    ): Promise<void> => {
      const id = requireList(listId);
      for (const seasonNumber of seasonNumbers) {
        await api.setSeasonWatched(id, itemId, seasonNumber, watched);
      }
      await refreshList(id);
    },

    setEpisodeWatched: async (
      itemId: number,
      seasonNumber: number,
      episodeNumber: number,
      watched: boolean,
      listId?: number
    ): Promise<void> => {
      const id = requireList(listId);
      await api.setEpisodeWatched(
        id,
        itemId,
        seasonNumber,
        episodeNumber,
        watched
      );
      await refreshList(id);
    },

    share: async (
      input: { userId: number; role: CollaboratorRole },
      listId?: number
    ): Promise<Collaborator> => {
      const id = requireList(listId);
      const shared = await api.shareMediaList(id, input);
      await refreshCollaborators(id);
      return toCollaborator(shared);
    },

    changeCollaboratorRole: async (
      userId: number,
      role: CollaboratorRole,
      listId?: number
    ): Promise<Collaborator> => {
      const id = requireList(listId);
      const updated = await api.updateCollaboratorRole(id, userId, role);
      await refreshCollaborators(id);
      return toCollaborator(updated);
    },

    removeCollaborator: async (
      userId: number,
      listId?: number
    ): Promise<void> => {
      const id = requireList(listId);
      await api.removeCollaborator(id, userId);
      await refreshCollaborators(id);
      // Losing access changes which lists the index should show.
      await refreshIndex();
    },
  };
};
