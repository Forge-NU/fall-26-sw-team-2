import { Palette } from './palette';

export const AvatarTokens = {
  background: Palette.lightPink,
  iconColor: Palette.coral,

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
