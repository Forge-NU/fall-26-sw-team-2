import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { IconName } from '@/components/icon';
import { AppText } from '@/components/ui/app-text';
import { IconButton } from '@/components/ui/icon-button';
import { ButtonTokens } from '@/constants/button-tokens';
import { Spacing } from '@/constants/theme';

export type HeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

export type ScreenHeaderProps = {
  title?: string;
  left?: HeaderAction;
  // Usually one or two IconButtons
  right?: ReactNode;
  /**
   * The big Display title on the left ("Your trips"), with actions on the right.
   * It collapses into the centered title once the screen scrolls.
   */
  largeTitle?: boolean;
  /** Back (and actions) with no title, e.g. over a trip whose title is on the page */
  hideTitle?: boolean;
};

// The nav header: Back, Back with actions, Back with the title hidden, or a
// large title. The Yuji wordmark header is `YujiHeader`. Pass it to Screen's
// `header` prop.
export function ScreenHeader({ title, left, right, largeTitle = false, hideTitle = false }: ScreenHeaderProps) {
  if (largeTitle) {
    return (
      <View style={styles.large}>
        <AppText variant="display" numberOfLines={1} accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {left ? <IconButton icon={left.icon} accessibilityLabel={left.label} onPress={left.onPress} /> : null}
      </View>
      <AppText variant="headline" numberOfLines={1} accessibilityRole="header" style={styles.title}>
        {hideTitle ? '' : title}
      </AppText>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ButtonTokens.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Same width on both sides so the title stays centered. The negative margins
  // line the icons up with the screen gutter instead of the button's padding.
  side: {
    minWidth: ButtonTokens.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -Spacing.two,
  },
  right: { justifyContent: 'flex-end', marginLeft: 0, marginRight: -Spacing.two },
  title: { flex: 1, textAlign: 'center' },
  large: { minHeight: ButtonTokens.minHeight, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
