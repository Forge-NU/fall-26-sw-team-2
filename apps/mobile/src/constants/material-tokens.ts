import { Palette } from './palette';

// Frosted bars: the nav bar, the sticky day chip bar and the trip footer.
// On iOS 26 they use the system glass; elsewhere this 85% white plus a hairline.
export const MaterialTokens = {
  fallbackBackground: 'rgba(255, 255, 255, 0.85)',
  hairline: Palette.neutral200, // border/divider
  hairlineWidth: 1,
} as const;
