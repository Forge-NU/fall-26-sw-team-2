import { Text, type TextProps } from 'react-native';

import { Palette } from '@/constants/palette';
import {
  Typography,
  type TypographyVariant,
} from '@/constants/typography';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: keyof typeof Palette;
};

export function AppText({
  variant = 'body',
  color = 'black',
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        Typography[variant],
        { color: Palette[color] },
        style,
      ]}
    />
  );
}
