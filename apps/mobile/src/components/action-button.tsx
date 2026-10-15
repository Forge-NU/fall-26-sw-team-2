import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, IconName } from '@/components/icon';
import { Palette, Radius } from '@/constants/theme';

type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  tone?: 'coral' | 'teal';
  height?: number;
  fontSize?: number;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Full-width filled button used for the primary action on each screen. */
export function ActionButton({
  label,
  onPress,
  tone = 'coral',
  height = 44,
  fontSize = 14,
  leadingIcon,
  trailingIcon,
  disabled,
  style,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height, backgroundColor: Palette[tone] },
        (pressed || disabled) && styles.dimmed,
        style,
      ]}>
      {leadingIcon && <Icon name={leadingIcon} color="surface" />}
      <AppText variant="bold" size={fontSize} color="surface">
        {label}
      </AppText>
      {trailingIcon && <Icon name={trailingIcon} size={17} color="surface" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.sm,
  },
  dimmed: {
    opacity: 0.8,
  },
});
