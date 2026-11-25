import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/icon';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useStoryUploads } from '@/hooks/use-story-uploads';
import { discardStoryUpload, retryStoryUpload, type StoryUpload } from '@/lib/story-upload-queue';

/** One pill per story still posting or failed. Renders nothing once they're all posted. */
export function StoryUploadPills() {
  const uploads = useStoryUploads();
  return uploads.map((upload) => <StoryUploadPill key={upload.id} upload={upload} />);
}

function StoryUploadPill({ upload }: { upload: StoryUpload }) {
  if (upload.status !== 'failed') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.pill}>
        <ActivityIndicator size="small" color={Palette.coral} />
        <AppText variant="caption">
          Posting your story…
        </AppText>
      </View>
    );
  }

  return (
    <View accessibilityLiveRegion="polite" style={[styles.pill, styles.failed]}>
      <AppText variant="caption">
        Didn&apos;t post ·
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry posting your story"
        hitSlop={Spacing.two}
        onPress={() => retryStoryUpload(upload.id)}>
        <AppText variant="caption" color="coral">
          Retry
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Discard story"
        hitSlop={Spacing.two}
        onPress={() => discardStoryUpload(upload.id)}>
        <Icon name="x" size={14} color="placeholderGray" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radii.circle,
    borderWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
  failed: {
    borderColor: Palette.coral,
    backgroundColor: Palette.peach,
  },
});
