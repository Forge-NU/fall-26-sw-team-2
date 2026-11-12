import { Palette, Radii } from '@/constants/theme';
import { ShadowTokens } from '@/constants/shadow-tokens';
import { formatCount } from '@/utils/format-count';

// STAND-IN (UI-4 #98): the map tab's old color names, pointed at the shared
// theme so the files #121 and #122 edit keep their imports. New code imports
// @/constants/theme directly. Delete this once those PRs land.
export const colors = {
  forest: Palette.black,
  coral: Palette.coral,
  coralPressed: Palette.coral,
  star: Palette.coral,
  peach: Palette.peach,
  peachLine: Palette.lightPink,
  sage: Palette.lightTeal,
  sageIcon: Palette.lightTeal,
  sageBar: Palette.teal,
  barTrack: Palette.peach,
  cream: Palette.warmWhite,
  surface: Palette.white,
  text: Palette.black,
  textMuted: Palette.placeholderGray,
  textFaint: Palette.placeholderGray,
  line: Palette.peach,
};

export const radius = { sm: Radii.small, md: Radii.medium, lg: Radii.pill, xl: Radii.pill, pill: Radii.circle };

export const shadow = ShadowTokens.floating;

export { formatCount };
