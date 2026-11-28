import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppState, Platform } from "react-native";
import { Theme } from '@/constants/theme';
import { ToastProvider } from "@/components/ui/toast-provider";

import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import type { ReactNode } from "react";

import { getMockMode } from "@/api/mock";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AuthGate } from "@/components/auth-gate";
import { queryClient } from "@/lib/query-client";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

// With EXPO_PUBLIC_API_MOCKS=all, AuthGate signs in as the mock user, so the
// app runs without a Clerk key
function AuthProvider({ children }: { children: ReactNode }) {
  if (getMockMode() === "all") return children;
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  );
}

void SplashScreen.preventAutoHideAsync();

// React Query refetches stale queries when the window regains focus, which on
// native means the app coming back to the foreground. The web build already
// gets this from the browser.
if (Platform.OS !== "web") {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
    return () => subscription.remove();
  });
}

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
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '600' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
};

export default function TabLayout() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <ToastProvider>
            <AnimatedSplashOverlay />
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="trips/new" options={{ presentation: "modal" }} />
                <Stack.Screen name="trips/[id]/edit" options={{ presentation: "modal" }} />
                <Stack.Screen name="posts/new" options={{ presentation: "modal" }} />
                <Stack.Screen name="posts/[id]/edit" options={{ presentation: "modal" }} />
                <Stack.Screen name="notifications" />
                <Stack.Screen
                  name="stories/[ownerId]"
                  options={{ presentation: "fullScreenModal", animation: "fade" }}
                />
                <Stack.Screen
                  name="trips/[id]/stories"
                  options={{ presentation: "fullScreenModal", animation: "fade" }}
                />
              </Stack>
            </AuthGate>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
