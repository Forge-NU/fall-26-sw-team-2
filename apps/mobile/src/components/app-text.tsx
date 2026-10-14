import { Text, type TextProps } from 'react-native';

import { FontFamily, FontVariant, Palette, PaletteColor } from '@/constants/theme';

export type AppTextProps = TextProps & {
  /** `display` is Barlow Condensed; the rest are Plus Jakarta Sans weights. */
  variant?: FontVariant;
  size?: number;
  color?: PaletteColor;
  /** Line height as a multiple of `size`, matching the Figma values. */
  leading?: number;
};

export function AppText({
  variant = 'regular',
  size = 12,
  color = 'ink',
  leading,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[
        {
          fontFamily: FontFamily[variant],
          fontSize: size,
          color: Palette[color],
        },
        leading !== undefined && { lineHeight: Math.round(size * leading) },
        style,
      ]}
      {...rest}
    />
  );
}
