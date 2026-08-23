export enum CollaboratorRole {
  READ = 'read',
  WRITE = 'write',
}

export const isCollaboratorRole = (value: unknown): value is CollaboratorRole =>
  value === CollaboratorRole.READ || value === CollaboratorRole.WRITE;
