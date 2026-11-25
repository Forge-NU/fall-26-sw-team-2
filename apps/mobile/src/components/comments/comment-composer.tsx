import type { Ref } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import type { CommentResponse } from 'shared-types';

import { AppText } from '@/components/ui/app-text';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Palette, Spacing } from '@/constants/theme';
import { bodyToSend, canSendComment, COMMENT_MAX_LENGTH, commentLength } from '@/lib/comment-cache';

// The counter shows once you're this close to the limit
const COUNTER_FROM = COMMENT_MAX_LENGTH - 50;

type CommentComposerProps = {
  text: string;
  onChangeText: (text: string) => void;
  replyingTo: CommentResponse | null;
  onCancelReply: () => void;
  myId: string | undefined;
  sending: boolean;
  onSend: (body: string) => void;
  ref?: Ref<TextInputInstance>;
};

/** The comment box under the list. Post is off when it's empty or over 500 characters. */
export function CommentComposer({
  text,
  onChangeText,
  replyingTo,
  onCancelReply,
  myId,
  sending,
  onSend,
  ref,
}: CommentComposerProps) {
  const body = bodyToSend(text, replyingTo, myId);
  const length = commentLength(body);
  const over = length > COMMENT_MAX_LENGTH;
  const canSend = canSendComment(body) && !sending;

  return (
    <View style={styles.composer}>
      {replyingTo && (
        <View style={styles.replying}>
          <AppText variant="caption" color="placeholderGray" style={styles.replyingText}>
            Replying to @{replyingTo.author.username}
          </AppText>
          <IconButton icon="x" iconSize={Spacing.three} accessibilityLabel="Cancel reply" onPress={onCancelReply} />
        </View>
      )}
      <View style={styles.row}>
        <Input
          ref={ref}
          value={text}
          onChangeText={onChangeText}
          placeholder={replyingTo ? `Reply to @${replyingTo.author.username}…` : 'Add a comment…'}
          accessibilityLabel={replyingTo ? `Reply to @${replyingTo.author.username}` : 'Add a comment'}
          multiline
          editable={!sending}
          error={over ? `Comments can be up to ${COMMENT_MAX_LENGTH} characters` : undefined}
          containerStyle={styles.input}
        />
        <IconButton
          icon="send"
          color="coral"
          accessibilityLabel={replyingTo ? 'Post reply' : 'Post comment'}
          disabled={!canSend}
          onPress={() => onSend(body)}
        />
      </View>
      {length >= COUNTER_FROM && (
        <AppText
          variant="caption"
          color={over ? 'coral' : 'placeholderGray'}
          accessibilityLiveRegion="polite"
          style={styles.counter}>
          {length}/{COMMENT_MAX_LENGTH}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.peach,
    backgroundColor: Palette.warmWhite,
  },
  replying: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  replyingText: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  input: { flex: 1, width: undefined },
  counter: { alignSelf: 'flex-end' },
});
