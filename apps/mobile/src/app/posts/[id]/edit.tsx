import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { PostResponse } from 'shared-types';

import { getErrorMessage } from '@/api/client';
import { LocationPicker } from '@/components/location/location-picker';
import { StarRating } from '@/components/rating/star-rating';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast-provider';
import { Palette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { usePost, useUpdatePost } from '@/hooks/use-post';
import { POST_LIMITS } from '@/lib/post-form';
import {
  postEditValues,
  toUpdatePostRequest,
  validatePostEdit,
  type PostEditErrors,
  type PostEditValues,
} from '@/lib/post-edit';
import { canRateLocation } from '@/lib/picked-location';
import { charCount } from '@/lib/trip-form';

const SAVE_ERRORS = {
  403: 'Only the trip owner can edit this post.',
  404: 'This post no longer exists.',
  other: "Couldn't save your changes. Try again.",
};

/** The owner edits a post's caption, location and rating (#43 POST-3). */
export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = usePost(id);
  const close = () => router.back();

  return (
    <Screen
      loading={post.isPending}
      error={post.data ? null : post.error}
      onRetry={() => void post.refetch()}
      errorState={{ title: "Couldn't load this post" }}
      header={<ScreenHeader title="Edit post" left={{ icon: 'x', label: 'Close', onPress: close }} />}>
      {post.data ? <EditPostForm post={post.data} onDone={close} /> : null}
    </Screen>
  );
}

function EditPostForm({ post, onDone }: { post: PostResponse; onDone: () => void }) {
  const update = useUpdatePost(post.id);
  const { showToast } = useToast();
  const [values, setValues] = useState<PostEditValues>(() => postEditValues(post));
  const [errors, setErrors] = useState<PostEditErrors>({});
  const set = (next: Partial<PostEditValues>) => setValues((current) => ({ ...current, ...next }));

  const ratable = canRateLocation(values.location);
  // Picking a custom name drops the rating, so say so rather than losing it quietly
  const ratingCleared = post.rating != null && !ratable;
  const captionLength = charCount(values.caption.trim());

  const save = () => {
    const nextErrors = validatePostEdit(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const changes = toUpdatePostRequest(post, values);
    if (Object.keys(changes).length === 0) return onDone();
    update.mutate(changes, {
      onSuccess: () => {
        showToast({ message: 'Post updated', variant: 'success' });
        onDone();
      },
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Section label="Location" error={errors.location}>
          <LocationPicker
            label=""
            value={values.location}
            onChange={(location) => {
              set({ location });
              setErrors(({ location: _location, ...rest }) => rest);
            }}
          />
        </Section>

        <Section label="Your rating" aside={ratable && values.rating != null ? 'Tap again to clear' : undefined}>
          {ratable ? (
            <StarRating value={values.rating} onChange={(rating) => set({ rating })} size={28} />
          ) : (
            <AppText variant="label" style={styles.muted}>
              {unratableReason(values.location === null, ratingCleared)}
            </AppText>
          )}
        </Section>

        <Section
          label="Caption"
          aside={`${captionLength.toLocaleString('en-US')} / ${POST_LIMITS.caption.toLocaleString('en-US')}`}>
          <Input
            value={values.caption}
            onChangeText={(caption) => set({ caption })}
            placeholder="What happened here? (optional)"
            accessibilityLabel="Caption"
            multiline
            error={errors.caption}
            style={styles.caption}
          />
        </Section>
      </ScrollView>

      <View style={styles.footer}>
        {update.error ? (
          <AppText variant="label" accessibilityLiveRegion="polite" style={styles.error}>
            {getErrorMessage(update.error, SAVE_ERRORS)}
          </AppText>
        ) : null}
        <Button title="Save changes" loading={update.isPending} onPress={save} style={styles.submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

// Why there are no stars: a custom name or no location can't be rated (RATE-1, POST-4)
function unratableReason(noLocation: boolean, clearsRating: boolean): string {
  const what = noLocation ? 'A post with no location' : 'A custom place name';
  return clearsRating
    ? `${what} can't be rated, so saving this clears your rating.`
    : `${what} can't be rated. Pick a place or drop a pin to rate it.`;
}

type SectionProps = {
  label: string;
  aside?: string;
  error?: string;
  children: ReactNode;
};

// Same section labels as the post composer
function Section({ label, aside, error, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="caption" style={styles.muted}>
          {label}
        </AppText>
        {aside ? (
          <AppText variant="caption" style={styles.muted}>
            {aside}
          </AppText>
        ) : null}
      </View>
      {children}
      {error ? (
        <AppText variant="label" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: Spacing.three, paddingBottom: Spacing.four },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: Palette.placeholderGray },
  error: { color: Palette.coral, textAlign: 'center' },
  caption: { minHeight: 88, textAlignVertical: 'top' },
  footer: { gap: Spacing.two, paddingTop: Spacing.two },
  submit: { width: '100%' },
});
