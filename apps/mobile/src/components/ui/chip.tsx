import type { ReactNode } from 'react';
import { StyleSheet, Text, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ChipTokens } from '@/constants/chip-tokens';
import { ShadowTokens } from '@/constants/shadow-tokens';
import { AnimatedPressable, usePressScale } from './press-scale';

type BaseProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  onPress?: () => void;
};

export type ChipProps = BaseProps & {
  selected?: boolean;
  /** A small icon before the label, like the pin on a place */
  leadingIcon?: IconName;
};

/** Flat chip: gray, or coral with a bold white label when selected. Search categories, day chips. */
export function Chip({ label, selected = false, leadingIcon, onPress, ...props }: ChipProps) {
  const colors = ChipTokens.flat;
  const text = selected ? colors.selectedText : colors.text;
  return (
    <ChipFrame
      {...props}
      label={label}
      onPress={onPress}
      selected={selected}
      background={selected ? colors.selectedBackground : colors.background}
      textColor={text}
      leading={leadingIcon ? <Icon name={leadingIcon} size={ChipTokens.iconSize} color={selected ? 'white' : 'black'} /> : null}
    />
  );
}

export type GlassChipProps = BaseProps & {
  selected?: boolean;
  /** The location arrow, for "Near me" */
  nearIcon?: boolean;
  /** A chevron after the label: the chip opens a menu (never coral) */
  menu?: boolean;
};

/** Frosted chip over the map. A menu chip shows its current choice and is never coral. */
export function GlassChip({ label, selected = false, nearIcon, menu, onPress, ...props }: GlassChipProps) {
  const colors = ChipTokens.glass;
  const on = selected && !menu;
  return (
    <ChipFrame
      {...props}
      label={label}
      onPress={onPress}
      selected={on}
      background={on ? colors.selectedBackground : colors.background}
      textColor={on ? colors.selectedText : colors.text}
      border={on ? undefined : colors.border}
      floating
      leading={nearIcon ? <Icon name="navigate" size={ChipTokens.iconSize} color={on ? 'white' : 'black'} /> : null}
      trailing={menu ? <Icon name="chevron-down" size={ChipTokens.iconSize} color="neutral500" /> : null}
    />
  );
}

export type MenuButtonProps = BaseProps & {
  /** Tinted coral when a value other than the default is set, like a Dates filter */
  on?: boolean;
  chevron?: boolean;
};

/** A pull-down trigger like "Most relevant ▾". Tinted when it holds a set value. */
export function MenuButton({ label, on = false, chevron = true, onPress, ...props }: MenuButtonProps) {
  const colors = ChipTokens.menu;
  return (
    <ChipFrame
      {...props}
      label={label}
      onPress={onPress}
      background={on ? colors.onBackground : colors.background}
      textColor={on ? colors.onText : colors.text}
      trailing={
        chevron ? <Icon name="chevron-down" size={ChipTokens.iconSize} color={on ? 'coral600' : 'neutral500'} /> : null
      }
    />
  );
}

function ChipFrame({
  label,
  onPress,
  selected,
  background,
  textColor,
  border,
  floating,
  leading,
  trailing,
  ...props
}: BaseProps & {
  selected?: boolean;
  background: string;
  textColor: string;
  border?: string;
  floating?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const squish = usePressScale(Boolean(onPress));
  return (
    <AnimatedPressable
      {...props}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      onPressIn={squish.pressIn}
      onPressOut={squish.pressOut}
      style={[
        styles.chip,
        { backgroundColor: background },
        border ? { borderColor: border, borderWidth: StyleSheet.hairlineWidth } : null,
        floating ? ShadowTokens.floating : null,
        squish.animatedStyle,
      ]}>
      {leading}
      <Text style={[ChipTokens.typography, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: ChipTokens.height,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: ChipTokens.gap,
    paddingHorizontal: ChipTokens.paddingHorizontal,
    borderRadius: ChipTokens.borderRadius,
  },
});
