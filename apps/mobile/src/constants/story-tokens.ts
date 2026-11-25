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
  // The full-screen viewer (#25 STORY-3): dark bands behind the header and
  // caption, and the chips and progress bars over the photo
  viewer: {
    headerScrim: 'rgba(0,0,0,0.25)',
    captionScrim: 'rgba(0,0,0,0.35)',
    progressTrack: 'rgba(255,255,255,0.35)',
    chip: 'rgba(0,0,0,0.45)',
    textShadow: 'rgba(0,0,0,0.5)',
  },
} as const;
