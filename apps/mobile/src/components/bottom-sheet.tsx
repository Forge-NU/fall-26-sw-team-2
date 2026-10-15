import { type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Palette, Radius, ScreenGutter, Spacing } from '@/constants/theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  titleSize?: number;
  /** Optional line under the title. */
  subtitle?: string;
  closeSize?: number;
  gap?: number;
  children: ReactNode;
};

/** Dimmed modal sheet shared by the Post chooser and the story composer pickers. */
export function BottomSheet({
  visible,
  onClose,
  title,
  titleSize = 24,
  subtitle,
  closeSize = 18,
  gap = Spacing.three,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          entering={SlideInDown.duration(220)}
          style={[styles.sheet, { gap, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.heading}>
            <View style={styles.headingText}>
              <AppText variant="display" size={titleSize}>
                {title}
              </AppText>
              {subtitle && (
                <AppText size={12} color="inkMuted">
                  {subtitle}
                </AppText>
              )}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.close}>
              <Icon name="x" size={closeSize} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Palette.scrim,
  },
  sheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingTop: 10,
    paddingHorizontal: ScreenGutter,
  },
  handleRow: {
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headingText: {
    flex: 1,
    gap: 5,
  },
  close: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
