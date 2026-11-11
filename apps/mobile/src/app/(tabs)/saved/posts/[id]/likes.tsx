import { useLocalSearchParams } from 'expo-router';

import { PostLikesView } from '@/components/likes/post-likes-view';

export default function PostLikesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostLikesView postId={id} />;
}
