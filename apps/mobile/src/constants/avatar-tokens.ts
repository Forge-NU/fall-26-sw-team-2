import { Palette } from './palette';

export const AvatarTokens = {
  background: Palette.coral100, // bg/accent-subtle
  iconColor: Palette.coral700, // text/accent-strong

  sizes: {
    compact: {
      diameter: 20,
    },
    small: {
      diameter: 32,
    },
    medium: {
      diameter: 48,
    },
    large: {
      diameter: 80,
    },
  },
} as const;

export type AvatarSize = keyof typeof AvatarTokens.sizes;
