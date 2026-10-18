import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, Palette, Typography, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    ...Typography.label,
  },
  smallBold: {
    ...Typography.label,
    fontFamily: Typography.supporting.fontFamily,
  },
  default: {
    ...Typography.body,
  },
  title: {
    ...Typography.heading,
  },
  subtitle: {
    ...Typography.supporting,
  },
  link: {
    ...Typography.label,
  },
  linkPrimary: {
    ...Typography.label,
    color: Palette.coral,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: Typography.caption.fontSize,
    lineHeight: Typography.caption.lineHeight,
  },
});
