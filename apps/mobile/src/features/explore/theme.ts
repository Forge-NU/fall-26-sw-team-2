import { Platform } from 'react-native';

// Palette taken from the Explore wireframes (docs/design/map-wireframes.pdf).
export const colors = {
  forest: '#24413B', // active toggles, headings, primary dark buttons
  coral: '#F47A68', // brand accent: Post, Log a visit, active chip
  coralPressed: '#E2665A',
  star: '#CF5F4B',
  peach: '#FCE5DE',
  peachLine: '#EFCFC5',
  sage: '#EBF1E6', // tip and people cards, Filters button
  sageIcon: '#E7EEE8',
  sageBar: '#7FA38A',
  barTrack: '#E9ECE6',
  cream: '#FFFAF5', // sheets, pins, callouts
  surface: '#FFFFFF',
  text: '#1F2A27',
  textMuted: '#687570',
  textFaint: '#9AA39F',
  line: '#E5E1D9',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = Platform.select({
  ios: {
    shadowColor: '#24413B',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  default: { elevation: 6 },
});

export function formatCount(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}
