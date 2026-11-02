import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";

import { ButtonTokens } from "@/constants/button-tokens";
import { Spacing, Typography } from "@/constants/theme";

export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  onPress: () => void;
  variant?: "coral" | "teal";
  disabled?: boolean;
  loading?: boolean;
  size?: "default" | "compact";
};

export function Button({
  title,
  onPress,
  variant = "coral",
  disabled = false,
  loading = false,
  size = "default",
  style,
  onHoverIn,
  onHoverOut,
  onFocus,
  onBlur,
  accessibilityState,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isDisabled = disabled || loading;
  const colors = ButtonTokens[variant];

  return (
    <Pressable
      hitSlop={size === "compact" ? (ButtonTokens.minHeight - Spacing.five) / 2 : undefined}
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={(state) => {
        const active = !isDisabled && (state.pressed || hovered || focused);

        return [
          styles.button,
          size === "compact" && styles.compact,
          {
            backgroundColor: active
              ? colors.activeBackground
              : colors.defaultBackground,
            borderWidth: active ? colors.activeBorderWidth : colors.borderWidth,
            borderColor: colors.borderColor,
          },
          isDisabled && { opacity: ButtonTokens.disabledOpacity },
          typeof style === 'function' ? style(state) : style,
        ];
      }}
    >
      {({ pressed }) => {
        const active = !isDisabled && (pressed || hovered || focused);

        return (
          <>
            {loading && (
              <ActivityIndicator color={colors.defaultText} accessible={false} />
            )}
            <Text
              style={[
                styles.label,
                size === "compact" && Typography.label,
                { color: active ? colors.activeText : colors.defaultText },
              ]}
            >
              {title}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: {
    minWidth: 0,
    minHeight: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  button: {
    minWidth: ButtonTokens.minWidth,
    minHeight: ButtonTokens.minHeight,
    borderRadius: ButtonTokens.borderRadius,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    gap: ButtonTokens.gap,
    paddingHorizontal: ButtonTokens.paddingHorizontal,
    paddingVertical: ButtonTokens.paddingVertical,
  },
  label: {
    ...ButtonTokens.typography,
    textAlign: "center",
  },
});
