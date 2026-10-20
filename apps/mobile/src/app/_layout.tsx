import { DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { Theme, Typography } from '@/constants/theme';
import { ToastProvider } from "@/components/ui/toast-provider";

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import AuthGate from '@/components/auth-gate';

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

void SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    primary: Theme.colors.primary,
    background: Theme.colors.background,
    card: Theme.colors.background,
    text: Theme.colors.text,
    border: Theme.colors.border,
    notification: Theme.colors.notification,
  },
  fonts: {
    regular: { fontFamily: Typography.body.fontFamily, fontWeight: '400' as const },
    medium: { fontFamily: Typography.subheading.fontFamily, fontWeight: '600' as const },
    bold: { fontFamily: Typography.supporting.fontFamily, fontWeight: '700' as const },
    heavy: { fontFamily: Typography.supporting.fontFamily, fontWeight: '700' as const },
  },
};

export default function TabLayout() {

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    BarlowCondensed_600SemiBold,
  });

  useEffect(() => {
    if (fontError) {
      console.error("Failed to load design fonts:", fontError);
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ThemeProvider value={navigationTheme}>
        <ToastProvider>
          <AnimatedSplashOverlay />
          <AuthGate />
        </ToastProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
