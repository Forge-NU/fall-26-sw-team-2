import { Palette } from './palette';
import { Typography } from './typography';

// Chip, GlassChip and MenuButton. Only a selected chip is coral.
export const ChipTokens = {
  height: 32,
  paddingHorizontal: 12,
  gap: 4,
  iconSize: 14,
  borderRadius: 999, // radius/full
  typography: Typography.label,

  flat: {
    background: Palette.neutral100, // bg/subtle
    text: Palette.black,
    selectedBackground: Palette.coral500, // action/primary
    selectedText: Palette.white, // text/on-accent, Bold
  },
  // Over the map: frosted white, a hairline and the Floating shadow
  glass: {
    background: 'rgba(255, 255, 255, 0.85)',
    border: Palette.neutral200,
    text: Palette.black,
    selectedBackground: Palette.coral500,
    selectedText: Palette.white,
  },
  menu: {
    background: Palette.neutral100,
    text: Palette.black,
    chevron: Palette.neutral500,
    onBackground: Palette.coral100, // bg/accent-subtle
    onText: Palette.coral600, // text/accent
    onChevron: Palette.coral600,
  },
} as const;
