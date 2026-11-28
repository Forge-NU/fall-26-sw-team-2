import { Palette } from '@/constants/theme';

// Coral tints from the photo placeholder, light to the logo coral
const Tints = [Palette.coral100, Palette.coral200, Palette.coral300, Palette.neutral100];

/** Stable brand tint for a seed, so the same person or photo always gets the same color. */
export function tintFor(seed: string) {
  let hash = 7;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return Tints[hash % Tints.length];
}
