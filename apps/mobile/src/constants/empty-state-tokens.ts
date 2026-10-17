import { Palette } from './palette';
import { Typography } from './typography';

export const EmptyStateTokens = {
  maxWidth: 361,
  padding: 16,
  paddingVertical: 12,
  gap: 8,
  copyGap: 4,
  copyMaxWidth: 260,
  actionMarginTop: 4,
  titleTypography: { ...Typography.supporting, fontFamily: Typography.subheading.fontFamily },
  iconSize: 20,
  iconColor: Palette.teal,
} as const;
