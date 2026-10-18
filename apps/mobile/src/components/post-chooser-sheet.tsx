import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon, IconName } from '@/components/icon';
import { Palette, Radii } from '@/constants/theme';

type PostChooserSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreateItinerary: () => void;
  onPostStory: () => void;
};

export function PostChooserSheet({
  visible,
  onClose,
  onCreateItinerary,
  onPostStory,
}: PostChooserSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Post"
      subtitle="Plan a new trip or share a moment.">
      <View style={styles.options}>
        <PostOption
          label="Create itinerary"
          icon="route"
          tone="coral"
          onPress={onCreateItinerary}
        />
        <PostOption
          label="Post story"
          icon="images"
          tone="teal"
          onPress={onPostStory}
        />
      </View>
    </BottomSheet>
  );
}

function PostOption({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: IconName;
  tone: 'coral' | 'teal';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { borderColor: tone === 'coral' ? 'rgba(252,122,108,0.15)' : 'rgba(125,197,199,0.15)' },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.symbol, { backgroundColor: Palette[tone] }]}>
        <Icon name={icon} size={23} color="warmWhite" />
      </View>
      <AppText variant="subheading" style={styles.label}>
        {label}
      </AppText>
      <Icon name="chevron-right" color={tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 12,
    paddingBottom: 12,
  },
  option: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radii.small,
    borderWidth: 1,
    backgroundColor: Palette.peach,
  },
  pressed: {
    opacity: 0.8,
  },
  symbol: {
    width: 44,
    height: 44,
    borderRadius: Radii.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
});
