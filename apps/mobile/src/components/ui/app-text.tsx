import { Text, type TextProps } from 'react-native';

import { Palette } from '@/constants/palette';
import { Colors, type ThemeColor } from '@/constants/theme';
import {
  Typography,
  type TypographyVariant,
} from '@/constants/typography';

/** A color role (`textSecondary`), or an old Palette name until screens move to roles */
export type TextColor = ThemeColor | keyof typeof Palette;

export function resolveColor(color: TextColor): string {
  return color in Colors.light
    ? Colors.light[color as ThemeColor]
    : Palette[color as keyof typeof Palette];
}

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
};

export function AppText({
  variant = 'body',
  color = 'text',
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        Typography[variant],
        { color: resolveColor(color) },
        style,
      ]}
    />
  );
}
