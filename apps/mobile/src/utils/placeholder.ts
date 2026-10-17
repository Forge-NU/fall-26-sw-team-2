import { Palette } from '@/constants/theme';

const Tints = [Palette.coralSoft, Palette.tealSoft, Palette.tealMist, Palette.coralBorder];

/** Stable brand tint for a seed, so the same person or photo always gets the same color. */
export function tintFor(seed: string) {
  let hash = 7;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return Tints[hash % Tints.length];
}

/** "Maya Chen" → "MC"; `max` caps how many letters are shown. */
export function initialsFor(name: string, max = 2) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((word) => word[0].toUpperCase())
    .join('');
}
