import { Palette } from './palette';

// The small + after a place name; a filled coral check once the place is saved
export const PlaceSaveTokens = {
  hitArea: 44,
  ring: 26,
  ringWidth: 1.5,
  iconSize: 16,
  ringColor: Palette.neutral500,
  iconColor: Palette.neutral700,
  savedBackground: Palette.coral500,
  savedIcon: Palette.white,
} as const;
