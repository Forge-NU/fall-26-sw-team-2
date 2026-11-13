import { Palette } from './palette';
import { Radii, Spacing } from './theme';

// One look for BottomSheet and the map's panel (UI-4 #98): corners, handle,
// background and padding. The backdrop is Theme.colors.scrim.
export const SheetTokens = {
  radius: Radii.pill,
  background: Palette.warmWhite,
  paddingHorizontal: Spacing.three,
  paddingTop: Spacing.two,
  handle: { width: 36, height: Spacing.one, color: Palette.lightPink },
} as const;
