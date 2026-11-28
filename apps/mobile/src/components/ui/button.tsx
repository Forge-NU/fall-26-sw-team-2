import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';

import { ButtonTokens, type ButtonType } from '@/constants/button-tokens';
import { AnimatedPressable, usePressScale } from './press-scale';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  onPress: () => void;
  /**
   * primary: coral fill, bold white label. secondary: gray fill. tertiary: coral
   * text, no fill. tinted: coral text on a light coral fill.
   * Old name: `coral` is tinted, or primary when `filled`.
   */
  variant?: ButtonType | 'coral';
  disabled?: boolean;
  loading?: boolean;
  /** large is 52 tall, small is 36. `default` and `compact` are the old names. */
  size?: 'large' | 'small' | 'default' | 'compact';
  /** Old prop: turns a `coral` button into primary, e.g. once a form is ready */
  filled?: boolean;
};

function resolveType(variant: ButtonProps['variant'], filled: boolean): ButtonType {
  if (variant === 'coral') return filled ? 'primary' : 'tinted';
  return variant ?? 'primary';
}

export function Button({
  title,
  onPress,
  variant = 'coral',
  disabled = false,
  loading = false,
  size = 'large',
  filled = false,
  style,
  onPressIn,
  onPressOut,
  accessibilityState,
  ...props
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const type = resolveType(variant, filled);
  const small = size === 'small' || size === 'compact';
  const sizeTokens = small ? ButtonTokens.sizes.small : ButtonTokens.sizes.large;
  const colors = ButtonTokens[type];
  const squish = usePressScale(!isDisabled);

  // A disabled primary or secondary turns gray; tertiary and tinted just fade
  const solidDisabled = isDisabled && (type === 'primary' || type === 'secondary');
  const background = solidDisabled
    ? ButtonTokens.disabled.background
    : pressed ? colors.pressedBackground : colors.background;
  const textColor = solidDisabled
    ? ButtonTokens.disabled.text
    : pressed ? colors.pressedText : colors.text;

  const state: PressableStateCallbackType = { pressed, hovered: false };

  return (
    <AnimatedPressable
      hitSlop={small ? (ButtonTokens.minHeight - sizeTokens.height) / 2 : undefined}
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={(event) => {
        setPressed(true);
        squish.pressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        squish.pressOut();
        onPressOut?.(event);
      }}
      style={[
        styles.button,
        small && styles.small,
        { minHeight: sizeTokens.height, backgroundColor: background },
        isDisabled && !solidDisabled && { opacity: ButtonTokens.disabledOpacity },
        squish.animatedStyle,
        typeof style === 'function' ? style(state) : style,
      ]}>
      {loading && <ActivityIndicator color={textColor} accessible={false} />}
      <Text style={[sizeTokens.typography, styles.label, { color: textColor }]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: ButtonTokens.minWidth,
    borderRadius: ButtonTokens.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: ButtonTokens.gap,
    paddingHorizontal: ButtonTokens.paddingHorizontal,
  },
  small: {
    minWidth: 0,
    paddingHorizontal: ButtonTokens.sizes.small.paddingHorizontal,
  },
  label: { textAlign: 'center' },
});
