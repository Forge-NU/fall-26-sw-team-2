import { Button } from '@/components/ui/button';
import { useFollow } from '@/hooks/use-follow';

type FollowButtonProps = {
  userId: string;
  username: string;
  isFollowing: boolean;
  size?: 'default' | 'compact';
};

/** Coral "Follow", teal "Following". Callers leave it out on your own profile. */
export function FollowButton({ userId, username, isFollowing, size = 'default' }: FollowButtonProps) {
  const { toggle } = useFollow(userId);
  return (
    <Button
      title={isFollowing ? 'Following' : 'Follow'}
      variant={isFollowing ? 'teal' : 'coral'}
      size={size}
      accessibilityLabel={isFollowing ? `Unfollow @${username}` : `Follow @${username}`}
      accessibilityState={{ selected: isFollowing }}
      onPress={() => toggle(isFollowing)}
    />
  );
}
