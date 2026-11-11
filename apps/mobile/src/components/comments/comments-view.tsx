import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CommentResponse } from 'shared-types';

import { ApiError } from '@/api/client';
import { listComments } from '@/api/comments';
import { getMyProfile } from '@/api/profiles';
import { queryKeys } from '@/api/query-keys';
import { ListEmpty, ListFooter } from '@/components/content/list-states';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { useCreateComment, useDeleteComment } from '@/hooks/use-comments';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { commentKeys, replyPrefill } from '@/lib/comment-cache';
import { uniqueById } from '@/lib/engagement-cache';
import { CommentComposer } from './comment-composer';
import { CommentThread } from './comment-row';

/**
 * A post's comments, oldest first, Instagram-style: replies sit one level
 * under each comment behind "View replies", and the composer stays at the bottom.
 * POST-3 (#43) can put this under post detail.
 */
export function CommentsView({ postId }: { postId: string }) {
  const me = useQuery({ queryKey: queryKeys.myProfile, queryFn: ({ signal }) => getMyProfile(signal) });
  const myId = me.data?.id;
  const comments = useInfiniteList<CommentResponse>({
    queryKey: commentKeys.list(postId),
    fetchPage: (cursor, signal) => listComments(postId, cursor, signal),
  });
  const create = useCreateComment(postId);
  const remove = useDeleteComment(postId);

  const input = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentResponse | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const deleted = comments.error instanceof ApiError && comments.error.status === 404;

  const toggleReplies = (id: string, open = !expanded.has(id)) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const reply = (comment: CommentResponse) => {
    setReplyingTo(comment);
    setText(replyPrefill(comment, myId));
    input.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setText('');
  };

  const send = (body: string) =>
    create.mutate(
      { body, parent: replyingTo },
      {
        onSuccess: (comment) => {
          if (comment.parentCommentId) toggleReplies(comment.parentCommentId, true);
          setReplyingTo(null);
          setText('');
        },
      },
    );

  const confirmDelete = (comment: CommentResponse) => {
    const message = comment.parentCommentId || !comment.replyCount ? undefined : 'Its replies will be deleted too.';
    if (Platform.OS === 'web') {
      // Alert has no buttons on web
      if (globalThis.confirm(['Delete this comment?', message].filter(Boolean).join('\n'))) remove.mutate(comment);
      return;
    }
    Alert.alert('Delete this comment?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(comment) },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.bar}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/saved'))}
        />
        <AppText variant="heading" accessibilityRole="header">
          Comments
        </AppText>
      </View>
      {deleted ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Post no longer available"
          description="It may have been deleted."
          style={styles.centered}
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={BottomTabInset}
          style={styles.body}>
          <FlatList
            data={uniqueById(comments.items)}
            keyExtractor={(comment) => comment.id}
            renderItem={({ item }) => (
              <CommentThread
                comment={item}
                expanded={expanded.has(item.id)}
                onToggleReplies={() => toggleReplies(item.id)}
                myId={myId}
                onReply={reply}
                onDelete={confirmDelete}
              />
            )}
            ListEmptyComponent={
              <ListEmpty
                list={comments}
                icon="chatbubble-outline"
                title="No comments yet"
                description="Ask about a place or say what you liked."
              />
            }
            ListFooterComponent={<ListFooter list={comments} />}
            onEndReached={comments.loadMore}
            onEndReachedThreshold={0.5}
            refreshing={comments.isRefetching && !comments.isFetchingNextPage}
            onRefresh={() => void comments.refetch()}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          />
          <CommentComposer
            ref={input}
            text={text}
            onChangeText={setText}
            replyingTo={replyingTo}
            onCancelReply={cancelReply}
            myId={myId}
            sending={create.isPending}
            onSend={send}
          />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite },
  body: { flex: 1, paddingBottom: BottomTabInset },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  content: { flexGrow: 1, gap: Spacing.three, padding: Spacing.three },
  centered: { alignSelf: 'center', marginTop: Spacing.five },
});
