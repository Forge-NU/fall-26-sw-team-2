import { Palette } from './palette';
import { Radii, Spacing } from './theme';

// One look for BottomSheet and the map's panel: corners, handle, background
// and padding. The backdrop is Theme.colors.scrim.
export const SheetTokens = {
  radius: Radii.lg,
  background: Palette.white,
  paddingHorizontal: Spacing.three,
  paddingTop: Spacing.two,
  handle: { width: 36, height: 5, color: Palette.neutral300 },
} as const;
