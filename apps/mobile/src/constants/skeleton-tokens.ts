import { Palette } from './palette';

// Temporary loading treatment. 
export const SkeletonTokens = {
  background: Palette.peach,
  height: 16,
  radius: 4,
  duration: 900,
  minOpacity: 0.45,
  maxOpacity: 1,
  previewSize: 44,
  previewGap: 8,
} as const;
