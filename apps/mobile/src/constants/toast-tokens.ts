import { Palette } from './palette';
import { Typography } from './typography';

export const ToastTokens = {
  duration: 4000,
  maxWidth: 361,
  borderRadius: 6,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 8,
  screenMargin: 16,

  typography: {
    ...Typography.body,
    fontSize: Typography.label.fontSize,
    lineHeight: Typography.label.lineHeight,
  },
  text: Palette.black,

  variants: {
    success: {
      background: Palette.lightTeal,
      border: Palette.teal,
    },
    error: {
      background: Palette.peach,
      border: Palette.coral,
    },
    info: {
      background: Palette.warmWhite,
      border: Palette.teal,
    },
  },
} as const;

export type ToastVariant = keyof typeof ToastTokens.variants;
