// Primitives from the Figma Foundations page. Screens use the roles in
// theme.ts (`Colors.light`), not these values directly.
const Primitives = {
  coral50: '#FFF5F3',
  coral100: '#FEEAE6',
  coral200: '#FFD4CD',
  coral300: '#FEB3A7',
  coral400: '#FC7A6C', // the logo coral; never behind text
  coral500: '#E65F52', // buttons, with bold white text only
  coral600: '#C94A3D', // lightest coral for text at any weight
  coral700: '#A7382B',
  coral800: '#812A1E',
  coral900: '#5B1C13',

  white: '#FFFFFF',
  white94: 'rgba(255, 255, 255, 0.94)',
  neutral50: '#F7F7F8',
  neutral100: '#F2F2F4',
  neutral200: '#EDEDEF',
  neutral300: '#D9D9DE',
  neutral400: '#A1A1A8', // disabled only
  neutral500: '#6B6B72', // lightest gray for text that matters
  neutral700: '#3A3A40',
  neutral900: '#1C1C1F',
  black: '#0B0B0C',
  black35: 'rgba(11, 11, 12, 0.35)',

  red50: '#FFF4F3',
  red600: '#D0193A',
  red800: '#860F23',
  green50: '#EEFBF0',
  green600: '#11813C',
  green800: '#154F27',

  blue500: '#007AFF', // the system location dot only
} as const;

// The old names, kept so the screens that still import them compile. Each
// redesign ticket moves its own screens to the roles, and the last one deletes
// these. Teal is gone.
const Deprecated = {
  warmWhite: Primitives.white,
  peach: Primitives.neutral100,
  lightPink: Primitives.neutral200,
  coralPink: Primitives.coral300,
  coral: Primitives.coral500,
  placeholderGray: Primitives.neutral500,
} as const;

export const Palette = { ...Primitives, ...Deprecated } as const;
export type PaletteKey = keyof typeof Palette;
