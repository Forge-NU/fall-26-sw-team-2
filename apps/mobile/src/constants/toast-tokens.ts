import { Palette } from './palette';
import { Typography } from './typography';

export const ToastTokens = {
  duration: 4000,
  // A toast with an action (like Undo) stays longer
  actionDuration: 6000,
  maxWidth: 361,
  borderRadius: 14, // radius/md
  paddingHorizontal: 16,
  paddingVertical: 12,
  gap: 8,
  iconSize: 20,
  screenMargin: 16,

  typography: Typography.subhead,
  actionTypography: Typography.headline,

  variants: {
    success: { background: Palette.green50, icon: Palette.green600, text: Palette.green800, glyph: 'checkmark-circle' },
    error: { background: Palette.red50, icon: Palette.red600, text: Palette.red800, glyph: 'warning' },
    info: { background: Palette.neutral100, icon: Palette.neutral500, text: Palette.black, glyph: 'information-circle' },
  },
  actionText: Palette.coral600,
} as const;

export type ToastVariant = keyof typeof ToastTokens.variants;
