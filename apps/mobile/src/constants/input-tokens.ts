import { Palette } from './palette';
import { Typography } from './typography';

export const InputTokens = {
  minHeight: 44,
  borderRadius: 14, // radius/md
  borderWidth: 1,
  focusedBorderWidth: 2,
  paddingHorizontal: 12,
  paddingVertical: 8,
  gap: 4,

  typography: Typography.body,
  labelTypography: Typography.footnote,

  background: Palette.white,
  text: Palette.black,
  border: Palette.neutral300, // border/default
  // Black, so the only colored border is a real error
  focusedBorder: Palette.black,
  errorBorder: Palette.red600,
  placeholder: Palette.neutral500,
  disabledBackground: Palette.neutral100,
  disabledOpacity: 0.5,
} as const;
