import { useLocalSearchParams } from 'expo-router';

import { FollowListView } from '@/components/profile/follow-list-view';

export default function FollowersScreen() {
  const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();
  return <FollowListView userId={id} list="followers" username={username} />;
}
