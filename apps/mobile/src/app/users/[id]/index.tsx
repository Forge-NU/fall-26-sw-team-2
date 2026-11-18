import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile/profile-view';

/** Profiles opened from search sit above the tabs, preserving the source tab. */
export default function SearchUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView userId={id} />;
}
