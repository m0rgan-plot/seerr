import {
  toOptionalUserRef,
  toUserRef,
} from '@server/features/mediaLists/data/mappers/userRefMapper';
import type MediaListCollaboratorRecord from '@server/features/mediaLists/data/orm/MediaListCollaboratorRecord';
import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import {
  CollaboratorRole,
  isCollaboratorRole,
} from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';

// The column is a plain string, so a row written by an older build or by hand could hold
// anything. Treating an unknown value as read keeps a bad row from granting write access.
export const toCollaboratorRole = (value: string): CollaboratorRole =>
  isCollaboratorRole(value) ? value : CollaboratorRole.READ;

export const toCollaborator = (
  record: MediaListCollaboratorRecord
): Collaborator => ({
  user: toUserRef(record.user),
  role: toCollaboratorRole(record.role),
  invitedBy: toOptionalUserRef(record.invitedBy),
  createdAt: record.createdAt,
});
