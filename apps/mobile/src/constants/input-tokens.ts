import { Palette } from './palette';
import { Typography } from './typography';

export const InputTokens = {
  minHeight: 44,
  borderRadius: 6,
  borderWidth: 1,
  focusedBorderWidth: 1.5,
  paddingHorizontal: 10,
  paddingVertical: 8,
  gap: 4,

  typography: Typography.body,
  labelTypography: Typography.label,

  background: Palette.warmWhite,
  text: Palette.black,
  border: Palette.lightPink,
  focusedBorder: Palette.coral,
  errorBorder: Palette.coral,
  placeholder: Palette.placeholderGray,
  disabledBackground: Palette.peach,
  disabledOpacity: 0.5,
} as const;
