import { useUser } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import type { UserResponse } from 'shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppText } from '@/components/ui/app-text';
import { ApiError } from '@/api/client';
import { createMyProfile, getUsernameAvailability } from '@/api/users';
import { Palette, Typography } from '@/constants/theme';

// Same rule as the API (and what Clerk accepts, since usernames are used to
// sign in).
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,30}$/;

export default function OnboardingScreen({
  onComplete,
  loadError,
  onRetry,
}: {
  onComplete?: (profile: UserResponse) => void;
  loadError?: string;
  onRetry?: () => void;
}) {
  const { user } = useUser();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'unknown'>('idle');
  const [checkedUsername, setCheckedUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const candidate = username.trim();
    if (!USERNAME_PATTERN.test(candidate)) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const result = await getUsernameAvailability(candidate);
        if (!cancelled) {
          setCheckedUsername(candidate);
          setAvailability(result.available ? 'available' : 'taken');
        }
      } catch {
        // Don't block submitting on a failed check; the server still returns
        // 409 if the name is taken.
        if (!cancelled) {
          setCheckedUsername(candidate);
          setAvailability('unknown');
        }
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [username]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const profile = await createMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
      });
      onComplete?.(profile);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setAvailability('taken');
        setError('Username taken. Try another one.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Could not save your profile.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return <SafeAreaView style={styles.screen}><View style={styles.content}><AppText variant="heading" style={styles.title}>Your profile didn’t load</AppText><AppText style={styles.hint}>{loadError}</AppText><Button title="Try again" onPress={() => onRetry?.()} /></View></SafeAreaView>;
  }

  const usernameStatus = checkedUsername === username.trim()
    ? availability
    : USERNAME_PATTERN.test(username.trim()) ? 'checking' : 'idle';
  const usernameError = usernameStatus === 'taken' ? 'Username taken' : undefined;
  const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && USERNAME_PATTERN.test(username.trim()) && (usernameStatus === 'available' || usernameStatus === 'unknown');

  return (
    <SafeAreaView style={styles.screen}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <AppText variant="heading" style={styles.title}>Set up your profile</AppText>
        <AppText style={styles.hint}>Choose a username so friends can find you.</AppText>
        <Input label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" />
        <Input label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" />
        <Input
          label="Username"
          value={username}
          onChangeText={(value) => { setUsername(value.replace(/^@/, '')); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          placeholder="yourname"
          error={usernameError}
          hint={username.length > 0 && !USERNAME_PATTERN.test(username.trim()) ? '4–30 letters, numbers, or underscores.' : usernameStatus === 'checking' ? 'Checking availability…' : usernameStatus === 'available' ? 'Available' : undefined}
        />
        {error && <AppText style={styles.error}>{error}</AppText>}
        <Button title="Continue to Yuji" onPress={submit} loading={busy} disabled={!valid || busy} filled={valid} />
      </View>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 28, gap: 18 },
  title: { textAlign: 'center', color: Palette.black },
  hint: { textAlign: 'center', color: Palette.black },
  error: { textAlign: 'center', color: Palette.coral, ...Typography.label },
});
