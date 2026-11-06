import { useAuth, useClerk } from '@clerk/expo';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { UserResponse } from 'shared-types';

import { ApiError } from '@/api/client';
import { getMockMode } from '@/api/mock';
import { me as mockUser } from '@/api/mock-backend';
import { getMe } from '@/api/users';
import AuthScreen from '@/components/auth-screen';
import OnboardingScreen from '@/components/onboarding-screen';
import { Palette } from '@/constants/theme';
import { setAuthTokenGetter } from '@/lib/auth';
import { CurrentUserContext, type CurrentUser } from '@/lib/current-user';
import { queryClient } from '@/lib/query-client';

/**
 * Shows its children only once the user is signed in and has a username.
 * With EXPO_PUBLIC_API_MOCKS=all it skips Clerk and signs in as the mock user,
 * so the app runs without an account or the API.
 */
export const AuthGate = getMockMode() === 'all' ? MockAuthGate : ClerkAuthGate;

function MockAuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary>(mockUser);
  return (
    <CurrentUserContext.Provider
      value={{ user, setUser: (updated) => setUser({ ...updated, username: updated.username ?? user.username }) }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

function ClerkAuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { signOut } = useClerk();
  const [profileState, setProfileState] = useState<{
    userId: string;
    profile: UserResponse | null;
    error: string | null;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Declared before the profile effect so the token getter is in place for its request
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let active = true;
    void getMe().then(
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
  }, [isSignedIn, retryCount, userId]);

  if (!isLoaded || (isSignedIn && (!profileState || profileState.userId !== userId))) {
    return <View style={styles.center}><ActivityIndicator color={Palette.coral} /></View>;
  }
  if (!isSignedIn) return <AuthScreen />;
  if (!userId || !profileState || profileState.userId !== userId) return null;
  if (profileState.error) {
    return <OnboardingScreen loadError={profileState.error} onRetry={() => setRetryCount((count) => count + 1)} />;
  }
  const { profile } = profileState;
  if (!profile?.username) {
    return <OnboardingScreen onComplete={(created) => setProfileState({ userId, profile: created, error: null })} />;
  }

  const user: CurrentUser = { ...profile, username: profile.username };
  const handleSignOut = async () => {
    await signOut();
    // Don't let the next account see this one's cached trips and posts
    queryClient.clear();
    setProfileState(null);
  };
  return (
    <CurrentUserContext.Provider
      value={{
        user,
        signOut: handleSignOut,
        setUser: (updated) => setProfileState({ userId, profile: updated, error: null }),
      }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.warmWhite },
});
