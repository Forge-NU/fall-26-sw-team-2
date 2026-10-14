/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Yuji brand palette from the Figma wireframes. The wireframes are light-only,
 * so these do not switch with the color scheme.
 */
export const Palette = {
  ink: '#162a2a',
  inkMuted: '#58686b',
  disabled: '#a9b2b4',
  surface: '#fffcfa',
  border: '#e6e9ee',
  teal: '#7dc5c7',
  tealSoft: '#c5e1e1',
  tealMist: '#e5f5f5',
  coral: '#fc7a6c',
  coralSoft: '#ffe8df',
  coralBorder: '#ffc5be',
  scrim: 'rgba(22, 42, 42, 0.35)',
} as const;

export type PaletteColor = keyof typeof Palette;

/** Font families loaded in the root layout via @expo-google-fonts. */
export const FontFamily = {
  display: 'BarlowCondensed_600SemiBold',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export type FontVariant = keyof typeof FontFamily;

export const Radius = {
  sm: 6,
  md: 8,
  sheet: 16,
  pill: 999,
} as const;

/** Horizontal padding used by every Yuji screen. */
export const ScreenGutter = 20;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
