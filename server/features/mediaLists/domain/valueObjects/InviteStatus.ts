export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
}

export const isInviteStatus = (value: unknown): value is InviteStatus =>
  value === InviteStatus.PENDING || value === InviteStatus.ACCEPTED;
