import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type ReactElement, type RefObject } from 'react';
import { Alert, FlatList, Platform, StyleSheet, View, type TextInputInstance } from 'react-native';
import type { CommentResponse } from 'shared-types';

import { ApiError } from '@/api/client';
import { listComments } from '@/api/comments';
import { getMyProfile } from '@/api/profiles';
import { queryKeys } from '@/api/query-keys';
import { ListEmpty, ListFooter } from '@/components/content/list-states';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing } from '@/constants/theme';
import { useCreateComment, useDeleteComment } from '@/hooks/use-comments';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { commentKeys, replyPrefill } from '@/lib/comment-cache';
import { uniqueById } from '@/lib/engagement-cache';
import { CommentComposer } from './comment-composer';
import { CommentThread } from './comment-row';

/**
 * A post's comments, oldest first, Instagram-style: replies sit one level
 * under each comment behind "View replies", and the composer stays at the bottom.
 * Post detail (#43) puts the post above them as `header`, and wraps this in a
 * KeyboardAvoidingView so the composer clears the keyboard.
 */
export function CommentsView({
  postId,
  header,
  inputRef,
  onRefresh,
}: {
  postId: string;
  /** Scrolls with the comments, above them */
  header?: ReactElement;
  /** The composer's input, so the screen can focus it */
  inputRef?: RefObject<TextInputInstance | null>;
  /** Runs with pull to refresh, e.g. to reload the header's post */
  onRefresh?: () => void;
}) {
  const me = useQuery({ queryKey: queryKeys.myProfile, queryFn: ({ signal }) => getMyProfile(signal) });
  const myId = me.data?.id;
  const comments = useInfiniteList<CommentResponse>({
    queryKey: commentKeys.list(postId),
    fetchPage: (cursor, signal) => listComments(postId, cursor, signal),
  });
  const create = useCreateComment(postId);
  const remove = useDeleteComment(postId);

  const ownInput = useRef<TextInputInstance>(null);
  const input = inputRef ?? ownInput;
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

  if (deleted) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Post no longer available"
        description="It may have been deleted."
        style={styles.centered}
      />
    );
  }

  return (
    <View style={styles.body}>
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
        ListHeaderComponent={header}
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
        onRefresh={() => {
          void comments.refetch();
          onRefresh?.();
        }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { flexGrow: 1, gap: Spacing.three, paddingBottom: Spacing.three },
  centered: { alignSelf: 'center', marginTop: Spacing.five },
});
