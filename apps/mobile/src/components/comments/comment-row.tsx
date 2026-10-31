import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { CommentResponse } from 'shared-types';

import { listReplies } from '@/api/comments';
import { getErrorMessage } from '@/api/client';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { ContentTokens } from '@/constants/content-tokens';
import { Palette, Spacing } from '@/constants/theme';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { commentKeys, formatTimeAgo } from '@/lib/comment-cache';
import { uniqueById } from '@/lib/engagement-cache';

type CommentActions = {
  myId: string | undefined;
  onReply: (comment: CommentResponse) => void;
  onDelete: (comment: CommentResponse) => void;
};

type CommentThreadProps = CommentActions & {
  comment: CommentResponse;
  expanded: boolean;
  onToggleReplies: () => void;
};

/** A top-level comment, with its replies behind "View replies". */
export function CommentThread({ comment, expanded, onToggleReplies, ...actions }: CommentThreadProps) {
  return (
    <View style={styles.thread}>
      <CommentRow comment={comment} {...actions} />
      {comment.replyCount > 0 && (
        <View style={styles.replies}>
          {expanded && <Replies comment={comment} {...actions} />}
          <TextAction
            label={expanded ? 'Hide replies' : `View replies (${comment.replyCount})`}
            onPress={onToggleReplies}
          />
        </View>
      )}
    </View>
  );
}

function Replies({ comment, ...actions }: CommentActions & { comment: CommentResponse }) {
  const replies = useInfiniteList<CommentResponse>({
    queryKey: commentKeys.replies(comment.id),
    fetchPage: (cursor, signal) => listReplies(comment.id, cursor, signal),
  });

  if (replies.isPending) return <ActivityIndicator color={Palette.coral} style={styles.loading} />;
  if (replies.isError && !replies.items.length) {
    return (
      <View style={styles.repliesError}>
        <AppText variant="caption" color="placeholderGray">
          {getErrorMessage(replies.error)}
        </AppText>
        <TextAction label="Try again" onPress={() => void replies.refetch()} />
      </View>
    );
  }
  return (
    <>
      {uniqueById(replies.items).map((reply) => (
        <CommentRow key={reply.id} comment={reply} {...actions} />
      ))}
      {replies.hasNextPage && (
        <TextAction
          label={replies.isFetchingNextPage ? 'Loading…' : 'View more replies'}
          onPress={() => void replies.fetchNextPage()}
        />
      )}
    </>
  );
}

function CommentRow({ comment, myId, onReply, onDelete }: CommentActions & { comment: CommentResponse }) {
  const { author, replyTo } = comment;
  const name = `${author.firstName} ${author.lastName}`.trim() || author.username;
  const mine = author.id === myId;
  return (
    <View style={styles.row}>
      <Avatar name={name} uri={author.avatarUrl} size="small" />
      <View style={styles.copy}>
        <View style={styles.meta}>
          <AppText variant="label" numberOfLines={1} style={styles.name}>
            {author.username}
          </AppText>
          <AppText variant="caption" color="placeholderGray">
            {formatTimeAgo(comment.createdAt)}
          </AppText>
        </View>
        <AppText>
          {replyTo && <AppText color="teal">@{replyTo.username} </AppText>}
          {comment.body}
        </AppText>
        <View style={styles.actions}>
          <TextAction label="Reply" accessibilityLabel={`Reply to @${author.username}`} onPress={() => onReply(comment)} />
          {mine && <TextAction label="Delete" accessibilityLabel="Delete your comment" onPress={() => onDelete(comment)} />}
        </View>
      </View>
    </View>
  );
}

function TextAction({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <AppText variant="caption" color="placeholderGray">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thread: { gap: Spacing.two },
  replies: {
    // Lines replies up under the parent's text, past its avatar
    paddingLeft: Spacing.five + Spacing.two,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  copy: { flex: 1, minWidth: 0, gap: Spacing.half },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: Spacing.three },
  action: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: ContentTokens.actionSize,
  },
  pressed: { backgroundColor: Palette.peach },
  loading: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  repliesError: { gap: Spacing.one },
});
