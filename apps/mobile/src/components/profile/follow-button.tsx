import { Button } from '@/components/ui/button';
import { useFollow } from '@/hooks/use-follow';

type FollowButtonProps = {
  userId: string;
  /** "@username", or the name before onboarding */
  handle: string;
  isFollowing: boolean;
  size?: 'default' | 'compact';
};

/** Coral "Follow", gray "Following". Callers leave it out on your own profile. */
export function FollowButton({ userId, handle, isFollowing, size = 'default' }: FollowButtonProps) {
  const { toggle } = useFollow(userId);
  return (
    <Button
      title={isFollowing ? 'Following' : 'Follow'}
      variant={isFollowing ? 'secondary' : 'coral'}
      size={size}
      accessibilityLabel={isFollowing ? `Unfollow ${handle}` : `Follow ${handle}`}
      accessibilityState={{ selected: isFollowing }}
      onPress={() => toggle(isFollowing)}
    />
  );
}
