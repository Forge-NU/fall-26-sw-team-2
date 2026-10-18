import { Palette } from "./palette";
import { Typography } from './typography';

export const ButtonTokens = {
  minWidth: 137,
  minHeight: 44,
  borderRadius: 10,
  paddingHorizontal: 13,
  paddingVertical: 6,
  gap: 7,
  disabledOpacity: 0.5,

  typography: Typography.button,

  coral: {
    defaultBackground: `${Palette.peach}80`,
    defaultText: Palette.coral,
    activeBackground: Palette.coral,
    activeText: Palette.warmWhite,
    borderWidth: 0,
    activeBorderWidth: 0,
    borderColor: Palette.coral,
  },

  teal: {
    defaultBackground: Palette.warmWhite,
    defaultText: Palette.teal,
    activeBackground: Palette.teal,
    activeText: Palette.white,
    borderWidth: 1,
    activeBorderWidth: 1,
    borderColor: Palette.teal,
  },
} as const;
