// The wire shapes, defined once on the server and imported here so the two sides cannot
// drift. Nothing outside this folder and the mappers should import from this file:
// components work with the domain models instead.
export type {
  MediaListCollaborator as MediaListCollaboratorDto,
  MediaList as MediaListDto,
  MediaListEpisodeRef as MediaListEpisodeRefDto,
  MediaListItem as MediaListItemDto,
  MediaListItemProgress as MediaListItemProgressDto,
  MediaListItemRef as MediaListItemRefDto,
  MediaListRole as MediaListRoleDto,
  MediaListSeasonProgress as MediaListSeasonProgressDto,
  MediaListShowProgress as MediaListShowProgressDto,
  MediaListSummary as MediaListSummaryDto,
  MediaListUser as MediaListUserDto,
} from '@server/interfaces/api/mediaListInterfaces';
