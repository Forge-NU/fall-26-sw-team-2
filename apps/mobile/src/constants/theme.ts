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

const light = {
  text: Palette.black,
  background: Palette.warmWhite,
  backgroundElement: Palette.peach,
  backgroundSelected: Palette.lightPink,
  textSecondary: Palette.black,
  textPlaceholder: Palette.placeholderGray,
  primary: Palette.coral,
  accent: Palette.teal,
  border: Palette.lightPink,
  notification: Palette.coral,
} as const;
export const Colors = { light, dark: light } as const;
export type ThemeColor = keyof typeof light;

export const Fonts = {
  sans: Typography.body.fontFamily,
  display: Typography.heading.fontFamily,
  serif: Platform.OS === 'ios' ? 'ui-serif' : 'serif',
  rounded: Typography.body.fontFamily,
  mono: Platform.OS === 'ios' ? 'ui-monospace' : 'monospace',
} as const;

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radii = { small: InputTokens.borderRadius, medium: 8, button: ButtonTokens.borderRadius, pill: 12, circle: 999 } as const;
export const Theme = {
  mode: 'light',
  hasDesignedDarkMode: false,
  colors: light,
  palette: Palette,
  typography: Typography,
  fonts: Fonts,
  spacing: Spacing,
  radii: Radii,
  components: { button: ButtonTokens, input: InputTokens, avatar: AvatarTokens, toast: ToastTokens, emptyState: EmptyStateTokens, skeleton: SkeletonTokens },
} as const;
export { Palette, Typography };
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
