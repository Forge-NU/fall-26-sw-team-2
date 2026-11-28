import { Palette } from './palette';
import { Typography } from './typography';

export const ButtonTokens = {
  minWidth: 137,
  // Tap target for compact controls; Large buttons are taller than this
  minHeight: 44,
  borderRadius: 14, // radius/md
  paddingHorizontal: 20,
  gap: 8,
  disabledOpacity: 0.5,

  sizes: {
    large: { height: 52, typography: Typography.button },
    small: { height: 36, typography: Typography.label, paddingHorizontal: 16 },
  },

  // Fill and label for each type, at rest and pressed. White on coral is always Bold.
  primary: {
    background: Palette.coral500,
    pressedBackground: Palette.coral600,
    text: Palette.white,
    pressedText: Palette.white,
  },
  secondary: {
    background: Palette.neutral100,
    pressedBackground: Palette.neutral200,
    text: Palette.black,
    pressedText: Palette.black,
  },
  tertiary: {
    background: 'transparent',
    pressedBackground: 'transparent',
    text: Palette.coral600,
    pressedText: Palette.coral700,
  },
  // Coral text on a light coral fill, for actions inside lists
  tinted: {
    background: Palette.coral100,
    pressedBackground: Palette.coral100,
    text: Palette.coral600,
    pressedText: Palette.coral600,
  },
  disabled: {
    background: Palette.neutral100,
    text: Palette.neutral400,
  },
} as const;

export type ButtonType = 'primary' | 'secondary' | 'tertiary' | 'tinted';
