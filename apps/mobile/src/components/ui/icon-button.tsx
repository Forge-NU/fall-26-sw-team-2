import { useState } from "react";
import { StyleSheet, type PressableProps } from "react-native";
import { Icon, type IconName } from "@/components/icon";
import { AppText } from "./app-text";
import { AnimatedPressable, usePressScale } from "./press-scale";
import { ButtonTokens } from "@/constants/button-tokens";
import { Palette, Radii, Spacing } from "@/constants/theme";

export type IconButtonProps = Omit<
  PressableProps,
  "children" | "accessibilityLabel"
> & {
  icon: IconName;
  accessibilityLabel: string;
  selectedIcon?: IconName;
  selected?: boolean;
  count?: number;
  color?: keyof typeof Palette;
  iconSize?: number;
  variant?: "plain" | "surface";
};

export function IconButton({
  icon,
  accessibilityLabel,
  selectedIcon,
  selected,
  count,
  color = "black",
  iconSize = Spacing.four,
  variant = "plain",
  disabled,
  style,
  accessibilityState,
  onFocus,
  onBlur,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  ...props
}: IconButtonProps) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const squish = usePressScale(!disabled);
  return (
    <AnimatedPressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        ...accessibilityState,
        disabled: Boolean(disabled),
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
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
        variant === "surface" && styles.surface,
        !disabled &&
          (pressed || hovered) &&
          (variant === "surface" ? styles.activeSurface : styles.active),
        disabled && styles.disabled,
        squish.animatedStyle,
        typeof style === "function" ? style({ pressed, hovered }) : style,
      ]}
    >
      <Icon
        name={selected && selectedIcon ? selectedIcon : icon}
        color={
          selected || (!disabled && focused && variant === "plain")
            ? "coral500"
            : color
        }
        size={iconSize}
      />
      {count !== undefined && (
        <AppText variant="label">{count.toLocaleString()}</AppText>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: ButtonTokens.minHeight,
    minHeight: ButtonTokens.minHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Radii.circle,
  },
  surface: { backgroundColor: Palette.white },
  active: { backgroundColor: Palette.neutral100 },
  activeSurface: { backgroundColor: Palette.neutral200 },
  disabled: { opacity: ButtonTokens.disabledOpacity },
});
