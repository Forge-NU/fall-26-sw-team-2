import { useClerk, useUser } from '@clerk/expo';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { AuthGateContext } from '@/components/auth-gate';
import { Palette } from '@/constants/theme';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { profile, clearProfile } = useContext(AuthGateContext);

  return (
    <View style={styles.container}>
      <ThemedText type="title">My Profile</ThemedText>
      {profile && <ThemedText>{profile.firstName} {profile.lastName} · @{profile.username}</ThemedText>}
      <ThemedText>{user?.primaryEmailAddress?.emailAddress ?? user?.primaryPhoneNumber?.phoneNumber}</ThemedText>
      <Button title="Sign out" variant="teal" onPress={async () => { await signOut(); clearProfile(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 20, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: Palette.warmWhite },
});
