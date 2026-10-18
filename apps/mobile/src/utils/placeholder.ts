import { Palette } from '@/constants/theme';

const Tints = [Palette.peach, Palette.lightTeal, Palette.lightPink, Palette.coralPink];

/** Stable brand tint for a seed, so the same person or photo always gets the same color. */
export function tintFor(seed: string) {
  let hash = 7;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return Tints[hash % Tints.length];
}
