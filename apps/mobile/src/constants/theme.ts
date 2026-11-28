import '@/global.css';
import { Platform } from 'react-native';
import { Palette } from './palette';
import { Typography } from './typography';
import { ButtonTokens } from './button-tokens';
import { InputTokens } from './input-tokens';
import { AvatarTokens } from './avatar-tokens';
import { ToastTokens } from './toast-tokens';
import { EmptyStateTokens } from './empty-state-tokens';
import { SkeletonTokens } from './skeleton-tokens';
import { RatingTokens } from './rating-tokens';

// Color roles, one per Figma role. Screens and components use these.
// - White text on coral 500 (`primary`) is always Bold.
// - Coral text that isn't bold uses `textAccent` (coral 600), never `primary`.
// - Gray text that matters is never lighter than `textSecondary` (neutral 500).
//   `textDisabled` is for disabled things only.
// - `brandLogo` never sits behind text.
const light = {
  background: Palette.white, // bg/default
  card: Palette.neutral50, // bg/card
  backgroundElement: Palette.neutral100, // bg/subtle
  accentSubtle: Palette.coral100, // bg/accent-subtle
  overlay: Palette.white94, // bg/overlay
  scrim: Palette.black35, // bg/scrim

  text: Palette.black, // text/primary
  textSecondary: Palette.neutral500, // text/secondary
  textPlaceholder: Palette.neutral500, // text/placeholder
  textDisabled: Palette.neutral400, // text/disabled
  onAccent: Palette.white, // text/on-accent and icon/on-accent
  textAccent: Palette.coral600, // text/accent
  textAccentStrong: Palette.coral700, // text/accent-strong

  primary: Palette.coral500, // action/primary
  primaryPressed: Palette.coral600, // action/primary-pressed
  secondary: Palette.neutral100, // action/secondary
  secondaryPressed: Palette.neutral200, // action/secondary-pressed

  iconActive: Palette.coral500, // icon/active
  iconInactive: Palette.neutral500, // icon/inactive
  iconRating: Palette.coral500, // icon/rating

  border: Palette.neutral200, // border/divider
  borderStrong: Palette.neutral300, // border/default

  brandLogo: Palette.coral400, // brand/logo
  brandLogoSoft: Palette.coral300, // brand/logo-soft

  error: Palette.red600, // feedback/error
  errorBg: Palette.red50, // feedback/error-bg
  errorText: Palette.red800, // feedback/error-text
  success: Palette.green600, // feedback/success
  successBg: Palette.green50, // feedback/success-bg
  successText: Palette.green800, // feedback/success-text

  userLocation: Palette.blue500, // map/user-location

  // Old names, kept until the screens that use them move to the roles above
  backgroundSelected: Palette.neutral200,
  accent: Palette.coral600,
  notification: Palette.coral500,
} as const;
export const Colors = { light, dark: light } as const;
export type ThemeColor = keyof typeof light;

// SF Pro is the iOS system font, so no family is set: weights come from each text style
export const Fonts = {
  sans: undefined,
  display: undefined,
  serif: Platform.OS === 'ios' ? 'ui-serif' : 'serif',
  rounded: Platform.OS === 'ios' ? 'ui-rounded' : undefined,
  mono: Platform.OS === 'ios' ? 'ui-monospace' : 'monospace',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  twelve: 12,
  three: 16,
  twenty: 20,
  four: 24,
  five: 32,
  fortyEight: 48,
  six: 64,
} as const;

export const Radii = {
  sm: 10, // thumbnails
  md: 14, // buttons, inputs
  lg: 20, // cards, sheets
  full: 999, // chips, avatars, pills
  // Old names
  small: 10,
  medium: 10,
  button: 14,
  pill: 20,
  circle: 999,
} as const;

export const Theme = {
  mode: 'light',
  hasDesignedDarkMode: false,
  colors: light,
  palette: Palette,
  typography: Typography,
  fonts: Fonts,
  spacing: Spacing,
  radii: Radii,
  components: { button: ButtonTokens, input: InputTokens, avatar: AvatarTokens, toast: ToastTokens, emptyState: EmptyStateTokens, skeleton: SkeletonTokens, rating: RatingTokens },
} as const;
export { Palette, Typography };
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
