import globalMessages from '@app/i18n/globalMessages';
import { MediaStatus } from '@server/constants/media';
import type { MessageDescriptor } from 'react-intl';

// Shared between the hover chip, the always-on corner dot and the color legend, so the
// three can never disagree about what a status looks like.
export type StatusBadgeType =
  | 'default'
  | 'danger'
  | 'warning'
  | 'success'
  | 'light';

export const statusBadgeTypes: Partial<Record<MediaStatus, StatusBadgeType>> = {
  [MediaStatus.PENDING]: 'warning',
  [MediaStatus.PROCESSING]: 'default',
  [MediaStatus.PARTIALLY_AVAILABLE]: 'light',
  [MediaStatus.AVAILABLE]: 'success',
  [MediaStatus.BLOCKLISTED]: 'danger',
};

const dotColorByBadgeType: Record<StatusBadgeType, string> = {
  warning: 'bg-yellow-400',
  default: 'bg-indigo-400',
  success: 'bg-green-400',
  light: 'bg-gray-400',
  danger: 'bg-red-400',
};

export const statusDotClass = (status: MediaStatus): string | undefined => {
  const badgeType = statusBadgeTypes[status];
  return badgeType && dotColorByBadgeType[badgeType];
};

export const statusMessages: Partial<Record<MediaStatus, MessageDescriptor>> = {
  [MediaStatus.PENDING]: globalMessages.pending,
  [MediaStatus.PROCESSING]: globalMessages.processing,
  [MediaStatus.PARTIALLY_AVAILABLE]: globalMessages.partiallyavailable,
  [MediaStatus.AVAILABLE]: globalMessages.available,
  [MediaStatus.BLOCKLISTED]: globalMessages.blocklisted,
};

// Display order for the color legend, independent of the numeric enum order.
export const STATUS_LEGEND_ORDER: MediaStatus[] = [
  MediaStatus.PENDING,
  MediaStatus.PROCESSING,
  MediaStatus.PARTIALLY_AVAILABLE,
  MediaStatus.AVAILABLE,
  MediaStatus.BLOCKLISTED,
];
