import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Palette } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// The Yuji wireframes are light-only, so the app uses one light theme for now.
const YujiTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Palette.surface, text: Palette.ink },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // Keep the native splash up until fonts resolve; AnimatedSplashOverlay hides it.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={YujiTheme}>
      <StatusBar style="dark" />
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
