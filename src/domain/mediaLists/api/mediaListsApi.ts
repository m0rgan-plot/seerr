import type {
  MediaListCollaboratorDto,
  MediaListDto,
  MediaListItemDto,
  MediaListSummaryDto,
} from '@app/domain/mediaLists/api/dto';
import type { CollaboratorRole } from '@app/domain/mediaLists/models/Collaborator';
import type { MediaListItemFilter } from '@app/domain/mediaLists/models/MediaListItem';
import type { MediaType } from '@server/constants/media';
import axios from 'axios';

// One function per endpoint, returning the wire shape untouched. Callers go through the
// hooks, which map these into domain models.

export const mediaListsKey = '/api/v1/mediaLists';

export const invitesKey = `${mediaListsKey}/invites`;

export const membershipKey = (tmdbId: number, mediaType: MediaType) =>
  `${mediaListsKey}/membership?tmdbId=${tmdbId}&mediaType=${mediaType}`;

export const listKey = (mediaListId: number) =>
  `${mediaListsKey}/${mediaListId}`;

export const itemsKey = (mediaListId: number, filter?: MediaListItemFilter) =>
  filter && filter !== 'all'
    ? `${listKey(mediaListId)}/items?filter=${filter}`
    : `${listKey(mediaListId)}/items`;

export const progressKey = (mediaListId: number, itemId: number) =>
  `${listKey(mediaListId)}/items/${itemId}/progress`;

export const collaboratorsKey = (mediaListId: number) =>
  `${listKey(mediaListId)}/collaborators`;

const itemKey = (mediaListId: number, itemId: number) =>
  `${listKey(mediaListId)}/items/${itemId}`;

export const createMediaList = async (input: {
  name: string;
  description?: string | null;
}): Promise<MediaListDto> =>
  (await axios.post<MediaListDto>(mediaListsKey, input)).data;

export const updateMediaList = async (
  mediaListId: number,
  changes: { name?: string; description?: string | null }
): Promise<MediaListDto> =>
  (await axios.put<MediaListDto>(listKey(mediaListId), changes)).data;

export const deleteMediaList = async (mediaListId: number): Promise<void> => {
  await axios.delete(listKey(mediaListId));
};

export const fetchMediaLists = async (): Promise<MediaListSummaryDto[]> =>
  (await axios.get<MediaListSummaryDto[]>(mediaListsKey)).data;

export const addMediaListItem = async (
  mediaListId: number,
  input: { tmdbId: number; mediaType: MediaType }
): Promise<MediaListItemDto> =>
  (await axios.post<MediaListItemDto>(`${listKey(mediaListId)}/items`, input))
    .data;

export const removeMediaListItem = async (
  mediaListId: number,
  itemId: number
): Promise<void> => {
  await axios.delete(itemKey(mediaListId, itemId));
};

export const reorderMediaListItems = async (
  mediaListId: number,
  orderedItemIds: number[]
): Promise<void> => {
  await axios.post(`${listKey(mediaListId)}/items/reorder`, {
    orderedItemIds,
  });
};

export const setMovieWatched = async (
  mediaListId: number,
  itemId: number,
  watched: boolean
): Promise<void> => {
  const url = `${itemKey(mediaListId, itemId)}/watched`;
  await (watched ? axios.post(url) : axios.delete(url));
};

export const setSeasonWatched = async (
  mediaListId: number,
  itemId: number,
  seasonNumber: number,
  watched: boolean
): Promise<void> => {
  const url = `${itemKey(mediaListId, itemId)}/seasons/${seasonNumber}/watched`;
  await (watched ? axios.post(url) : axios.delete(url));
};

export const setEpisodeWatched = async (
  mediaListId: number,
  itemId: number,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean
): Promise<void> => {
  const url = `${itemKey(
    mediaListId,
    itemId
  )}/seasons/${seasonNumber}/episodes/${episodeNumber}/watched`;
  await (watched ? axios.post(url) : axios.delete(url));
};

export const shareMediaList = async (
  mediaListId: number,
  input: { userId: number; role: CollaboratorRole }
): Promise<MediaListCollaboratorDto> =>
  (
    await axios.post<MediaListCollaboratorDto>(
      collaboratorsKey(mediaListId),
      input
    )
  ).data;

export const updateCollaboratorRole = async (
  mediaListId: number,
  userId: number,
  role: CollaboratorRole
): Promise<MediaListCollaboratorDto> =>
  (
    await axios.put<MediaListCollaboratorDto>(
      `${collaboratorsKey(mediaListId)}/${userId}`,
      { role }
    )
  ).data;

export const removeCollaborator = async (
  mediaListId: number,
  userId: number
): Promise<void> => {
  await axios.delete(`${collaboratorsKey(mediaListId)}/${userId}`);
};

export const acceptWatchlistInvite = async (
  mediaListId: number
): Promise<MediaListCollaboratorDto> =>
  (
    await axios.post<MediaListCollaboratorDto>(
      `${listKey(mediaListId)}/invite/accept`
    )
  ).data;

export const rejectWatchlistInvite = async (
  mediaListId: number
): Promise<void> => {
  await axios.post(`${listKey(mediaListId)}/invite/reject`);
};
