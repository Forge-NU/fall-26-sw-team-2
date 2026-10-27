import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';
import { usePostDrafts } from '@/hooks/use-post-drafts';

// Shown on the owner's trip page when a post on this phone didn't finish uploading
export function PostDraftsBanner({ tripId }: { tripId: string }) {
  const { stuck } = usePostDrafts(tripId);
  if (stuck.length === 0) return null;

  const latest = stuck[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the draft so you can retry the upload"
      onPress={() =>
        router.push({ pathname: '/posts/new', params: { tripId, draftId: latest.id } })
      }
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
      <Ionicons name="cloud-offline-outline" size={18} color={Palette.coral} />
      <View style={styles.text}>
        <AppText variant="label">
          {stuck.length === 1
            ? "1 post didn't finish uploading"
            : `${stuck.length} posts didn't finish uploading`}
        </AppText>
      </View>
      <AppText variant="label" style={styles.retry}>
        Retry
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Palette.coral,
    backgroundColor: Palette.peach,
  },
  text: { flex: 1 },
  retry: { color: Palette.coral },
  pressed: { opacity: 0.7 },
});
