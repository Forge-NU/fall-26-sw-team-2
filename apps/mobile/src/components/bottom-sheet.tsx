import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { SheetTokens } from '@/constants/sheet-tokens';
import { Radii, Spacing, Theme } from '@/constants/theme';
import { IconButton } from '@/components/ui/icon-button';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Optional line under the title. */
  subtitle?: string;
  closeSize?: number;
  gap?: number;
  /** iOS only: called once the sheet has finished closing. */
  onDismiss?: () => void;
  children: ReactNode;
};

/** Dimmed modal sheet shared by the Post chooser and the story composer pickers. */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  closeSize = Spacing.four,
  gap = Spacing.three,
  onDismiss,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      {/* Lifts the sheet above the keyboard when it has text fields. Android
          needs it too: edge-to-edge (SDK 58) stops the window resizing. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          entering={SlideInDown.duration(220)}
          style={[styles.sheet, { gap, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.heading}>
            <View style={styles.headingText}>
              <AppText variant="heading">
                {title}
              </AppText>
              {subtitle && (
                <AppText variant="caption" color="placeholderGray">
                  {subtitle}
                </AppText>
              )}
            </View>
            <IconButton icon="x" iconSize={closeSize} accessibilityLabel="Close" onPress={onClose} style={styles.close} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
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
    backgroundColor: Theme.colors.scrim,
  },
  sheet: {
    backgroundColor: SheetTokens.background,
    borderTopLeftRadius: SheetTokens.radius,
    borderTopRightRadius: SheetTokens.radius,
    paddingTop: SheetTokens.paddingTop,
    paddingHorizontal: SheetTokens.paddingHorizontal,
  },
  handleRow: {
    alignItems: 'center',
  },
  handle: {
    width: SheetTokens.handle.width,
    height: SheetTokens.handle.height,
    borderRadius: Radii.circle,
    backgroundColor: SheetTokens.handle.color,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingText: {
    flex: 1,
    gap: Spacing.one,
  },
  // Lines the icon up with the sheet's edge instead of the button's padding
  close: {
    marginRight: -Spacing.two,
  },
});
