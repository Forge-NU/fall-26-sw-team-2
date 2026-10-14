import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import type { Traveler } from '@/data/mock';

type PostAuthorProps = {
  author: Traveler;
  meta: string;
  /** Feed cards show an inline Share action next to the overflow menu. */
  onShare?: () => void;
};

export function PostAuthor({ author, meta, onShare }: PostAuthorProps) {
  return (
    <View style={styles.row}>
      <Image source={author.avatar} style={styles.avatar} />
      <View style={styles.details}>
        <View style={styles.identity}>
          <AppText variant="bold" size={13}>
            {author.name}
          </AppText>
          {author.verified && <Icon name="verified" />}
        </View>
        <AppText size={11} color="inkMuted" numberOfLines={1}>
          {meta}
        </AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={8}>
        <Icon name="ellipsis" />
      </Pressable>
      {onShare && (
        <Pressable accessibilityRole="button" onPress={onShare} style={styles.share}>
          <View style={styles.shareIcon}>
            <Icon name="share" />
          </View>
          <AppText size={12}>Share</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
  },
  details: {
    flex: 1,
    gap: 3,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
