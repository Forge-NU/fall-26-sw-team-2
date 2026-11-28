import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MaterialTokens as T } from '@/constants/material-tokens';

export type MaterialProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** A hairline on the edge that meets content: `bottom` for a nav bar, `top` for a footer */
  edge?: 'top' | 'bottom' | 'none';
};

// Checked once: whether this iOS has the system glass (iOS 26)
const hasGlass = (() => {
  try {
    return isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

/**
 * The frosted bar under the nav bar, the sticky day chip bar and the trip
 * footer. iOS 26 gets the system glass; older iOS gets 85% white with a hairline.
 */
export function Material({ children, style, edge = 'none' }: MaterialProps) {
  const edgeStyle = edge === 'top' ? styles.top : edge === 'bottom' ? styles.bottom : null;
  if (hasGlass) {
    return (
      <GlassView glassEffectStyle="regular" style={[styles.base, edgeStyle, style]}>
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.base, styles.fallback, edgeStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: { backgroundColor: T.fallbackBackground },
  top: { borderTopWidth: T.hairlineWidth, borderTopColor: T.hairline },
  bottom: { borderBottomWidth: T.hairlineWidth, borderBottomColor: T.hairline },
});
