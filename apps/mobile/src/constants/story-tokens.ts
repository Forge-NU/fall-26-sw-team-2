import { Typography } from './typography';

export const StoryTokens = {
  // Darkens the top and bottom of the photo so the controls and text stay readable
  mediaScrim: {
    colors: ['rgba(23,26,33,0.13)', 'rgba(23,26,33,0)', 'rgba(23,26,33,0.56)'],
    locations: [0, 0.5, 1],
  },
  overlayText: {
    fontFamily: Typography.heading.fontFamily,
    fontSize: 22,
    lineHeight: 28,
    placeholder: 'rgba(255,252,250,0.7)',
  },
} as const;
