import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { AppText } from './app-text';
import { Button, type ButtonProps } from './button';
import { EmptyStateTokens } from '@/constants/empty-state-tokens';

export type EmptyStateProps = ViewProps & {
  title: string;
  description?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  action?: ButtonProps;
};

export function EmptyState({
  title,
  description,
  icon = 'file-tray-outline',
  action,
  style,
  ...props
}: EmptyStateProps) {
  return (
    <View {...props} style={[styles.container, style]}>
      <Ionicons
        name={icon}
        size={EmptyStateTokens.iconSize}
        color={EmptyStateTokens.iconColor}
        accessible={false}
      />
      <View style={styles.copy}>
        <AppText accessibilityRole="header" style={[EmptyStateTokens.titleTypography, styles.text]}>
          {title}
        </AppText>
        {description ? <AppText style={styles.text}>{description}</AppText> : null}
      </View>
      {action ? <View style={styles.action}><Button {...action} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: EmptyStateTokens.maxWidth,
    paddingHorizontal: EmptyStateTokens.padding,
    paddingVertical: EmptyStateTokens.paddingVertical,
    gap: EmptyStateTokens.gap,
    alignItems: 'center',
  },
  copy: {
    width: '100%',
    maxWidth: EmptyStateTokens.copyMaxWidth,
    gap: EmptyStateTokens.copyGap,
  },
  action: { marginTop: EmptyStateTokens.actionMarginTop },
  text: { textAlign: 'center' },
});
