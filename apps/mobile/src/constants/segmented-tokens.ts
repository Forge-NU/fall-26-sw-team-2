import { Palette } from './palette';
import { Typography } from './typography';

// The iOS-style segmented control: a gray track with the selected segment raised in white
export const SegmentedTokens = {
  height: 36,
  padding: 2,
  borderRadius: 10, // radius/sm
  segmentRadius: 8,
  gap: 4,
  iconSize: 14,
  typography: Typography.label,
  track: Palette.neutral100,
  selected: Palette.white,
  text: Palette.black,
  shadow: {
    shadowColor: Palette.black,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
} as const;
