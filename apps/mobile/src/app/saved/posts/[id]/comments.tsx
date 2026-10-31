import { useLocalSearchParams } from 'expo-router';

import { CommentsView } from '@/components/comments/comments-view';

export default function PostCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CommentsView postId={id} />;
}
