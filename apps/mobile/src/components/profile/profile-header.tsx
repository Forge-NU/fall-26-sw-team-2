import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ProfileResponse } from '@/api/profiles';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { FollowButton } from './follow-button';

type ProfileHeaderProps = {
  profile: ProfileResponse;
  /** Null on your own profile, which never shows the follow button */
  isFollowing: boolean | null;
};

/** Avatar, @username and the follower/following counts, which open the lists. */
export function ProfileHeader({ profile, isFollowing }: ProfileHeaderProps) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const openList = (list: 'followers' | 'following') =>
    router.push({ pathname: `/profile/users/[id]/${list}`, params: { id: profile.id, username: profile.username } });

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Avatar name={name || profile.username} uri={profile.avatarUrl} size="large" />
        <View style={styles.copy}>
          <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
            @{profile.username}
          </AppText>
          {name ? (
            <AppText variant="label" color="placeholderGray" numberOfLines={1}>
              {name}
            </AppText>
          ) : null}
          <View style={styles.counts}>
            <Count value={profile.followerCount} label="followers" onPress={() => openList('followers')} />
            <AppText variant="caption" color="placeholderGray">
              ·
            </AppText>
            <Count value={profile.followingCount} label="following" onPress={() => openList('following')} />
          </View>
        </View>
      </View>
      {isFollowing !== null && (
        <FollowButton userId={profile.id} username={profile.username} isFollowing={isFollowing} />
      )}
    </View>
  );
}

function Count({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} hitSlop={Spacing.two} onPress={onPress}>
      <AppText variant="label">
        {value} <AppText variant="label" color="placeholderGray">{label}</AppText>
      </AppText>
    </Pressable>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.identity}>
      <Skeleton circle width={80} height={80} />
      <View style={styles.copy}>
        <Skeleton width="70%" height={32} />
        <Skeleton width="50%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.three },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  copy: { flex: 1, minWidth: 0, gap: Spacing.half },
  counts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
});
