import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, getErrorMessage } from '@/api/client';
import { CommentsView } from '@/components/comments/comments-view';
import { PostDetail } from '@/components/posts/post-detail';
import { confirmAction } from '@/lib/confirm';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast-provider';
import { ButtonTokens } from '@/constants/button-tokens';
import { Spacing } from '@/constants/theme';
import { useDeletePost, usePost } from '@/hooks/use-post';
import { useCurrentUser } from '@/lib/current-user';

const POST_ERRORS = { 404: 'It may have been deleted.', other: "Couldn't delete the post. Try again." };

/**
 * One post with its likes, saves and comments (#43 POST-3). The post's
 * owner can edit or delete it. A deleted post, or one in someone else's
 * draft trip, is a 404.
 */
export default function PostDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const post = usePost(id);
  const user = useCurrentUser();
  const deletePost = useDeletePost(post.data);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const composer = useRef<TextInputInstance>(null);

  const isOwner = post.data?.author.id === user.id;
  const gone = post.error instanceof ApiError && post.error.status === 404;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      loading={post.isPending}
      // A 404 wins over cached data: the post was deleted while this was open
      error={post.data && !gone ? null : post.error}
      onRetry={gone ? undefined : () => void post.refetch()}
      errorState={
        gone
          ? {
              icon: 'alert-circle-outline',
              title: 'Post no longer available',
              description: 'It may have been deleted.',
              action: { title: 'Go back', onPress: back },
            }
          : { title: "Couldn't load this post" }
      }
      header={
        <ScreenHeader
          title="Post"
          left={{ icon: 'arrow-left', label: 'Back', onPress: back }}
          right={
            isOwner ? (
              <>
                <IconButton
                  icon="pencil"
                  accessibilityLabel="Edit post"
                  onPress={() => router.push({ pathname: '/posts/[id]/edit', params: { id } })}
                />
                <IconButton
                  icon="trash"
                  accessibilityLabel="Delete post"
                  disabled={deletePost.isPending}
                  onPress={() =>
                    confirmAction({
                      title: 'Delete this post?',
                      message: "Its photos, likes and comments go too. You can't undo this.",
                      confirmLabel: 'Delete',
                      destructive: true,
                      onConfirm: () =>
                        deletePost.mutate(undefined, {
                          onSuccess: () => {
                            showToast({ message: 'Post deleted', variant: 'success' });
                            back();
                          },
                          onError: (error) => {
                            showToast({ message: getErrorMessage(error, POST_ERRORS), variant: 'error' });
                          },
                        }),
                    })
                  }
                />
              </>
            ) : null
          }
        />
      }>
      {post.data ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          // Everything above this view: the safe area, Screen's top padding, the header and the gap under it
          keyboardVerticalOffset={insets.top + Spacing.two + ButtonTokens.minHeight + Spacing.three}
          style={styles.flex}>
          <CommentsView
            postId={id}
            inputRef={composer}
            onRefresh={() => void post.refetch()}
            header={
              <PostDetail
                post={post.data}
                fromTrip={from === 'trip'}
                onCommentPress={() => composer.current?.focus()}
              />
            }
          />
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
