import { useAuth } from '@clerk/expo';
import { createContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { UserResponse } from 'shared-types';

import AppTabs from '@/components/app-tabs';
import AuthScreen from '@/components/auth-screen';
import OnboardingScreen from '@/components/onboarding-screen';
import { ApiError, getMyProfile } from '@/lib/api';
import { Palette } from '@/constants/theme';

// The signed-in user's profile, loaded once by the gate so screens don't refetch
// it. Only provided once onboarding is complete, so profile.username is set.
export const AuthGateContext = createContext<{
  profile: UserResponse | null;
  clearProfile: () => void;
}>({ profile: null, clearProfile: () => {} });

export default function AuthGate() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [profileState, setProfileState] = useState<{
    userId: string;
    profile: UserResponse | null;
    error: string | null;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let active = true;
    void getMyProfile(() => getToken()).then(
      (profile) => { if (active) setProfileState({ userId, profile, error: null }); },
      (error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          setProfileState({ userId, profile: null, error: null });
        } else {
          setProfileState({
            userId,
            profile: null,
            error: error instanceof Error ? error.message : 'Could not load your profile.',
          });
        }
      },
    );
    return () => { active = false; };
  }, [getToken, isSignedIn, retryCount, userId]);

  if (!isLoaded || (isSignedIn && (!profileState || profileState.userId !== userId))) {
    return <View style={styles.center}><ActivityIndicator color={Palette.coral} /></View>;
  }
  if (!isSignedIn) return <AuthScreen />;
  if (!userId || !profileState || profileState.userId !== userId) return null;
  if (profileState.error) {
    return <OnboardingScreen loadError={profileState.error} onRetry={() => setRetryCount((count) => count + 1)} />;
  }
  if (!profileState.profile?.username) {
    return <OnboardingScreen onComplete={(profile) => setProfileState({ userId, profile, error: null })} />;
  }
  return (
    <AuthGateContext.Provider value={{ profile: profileState.profile, clearProfile: () => setProfileState(null) }}>
      <AppTabs />
    </AuthGateContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.warmWhite },
});
