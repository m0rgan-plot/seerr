import CachedImage from '@app/components/Common/CachedImage';
import type { MediaListUser } from '@app/domain/mediaLists/models/MediaList';

interface AvatarProps {
  user: MediaListUser;
  // h-9 w-9 matches CollaboratorList's "People with Access" rows. Smaller sizes are for
  // tighter contexts, like the shelf row's overlapping badges.
  size?: 'sm' | 'md';
  className?: string;
  // Dimmed while an invite is still pending, so an owner glancing at the list can tell
  // who has actually accepted from who has only been invited.
  pending?: boolean;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-6 w-6',
  md: 'h-9 w-9',
};

// The one avatar-with-fallback pattern for this feature: a circular, cropped image when
// the user has one, otherwise a plain grey circle. Reused wherever a person needs a face,
// so the "no avatar" fallback never has to be reinvented.
const Avatar = ({
  user,
  size = 'md',
  className = '',
  pending = false,
}: AvatarProps) => (
  <div
    className={`relative flex-none overflow-hidden rounded-full bg-gray-600 ${sizeClasses[size]} ${
      pending ? 'opacity-50' : ''
    } ${className}`}
  >
    {user.avatar && (
      <CachedImage
        type="avatar"
        src={user.avatar}
        alt=""
        fill
        className="object-cover"
      />
    )}
  </div>
);

export default Avatar;
