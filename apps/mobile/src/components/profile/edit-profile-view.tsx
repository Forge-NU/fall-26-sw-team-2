import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { getMe, updateMe, type ProfileResponse } from '@/api/profiles';
import { Icon } from '@/components/icon';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { usePhotoUpload } from '@/hooks/use-photo-upload';
import { hasChanges, MAX_NAME_LENGTH, nameChanges, nameError, type ProfileDraft } from '@/lib/edit-profile';
import { profileKeys } from '@/lib/follow-cache';
import { choosePhoto, takePhoto, type PickedPhoto, type PickPhotoResult } from '@/lib/media/pick-photo';
import { preparePhoto } from '@/lib/media/prepare-photo';
import { showToast } from '@/lib/toast';
import { BackBar } from './profile-view';

class AvatarUploadError extends Error {}

/** Edit your name and avatar. Nothing is saved, or uploaded, until you tap Save. */
export function EditProfileView() {
  const me = useQuery({ queryKey: profileKeys.me, queryFn: ({ signal }) => getMe(signal) });

  if (!me.data) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <BackBar title="Edit profile" />
        {me.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load your profile"
            description={getErrorMessage(me.error)}
            action={{ title: 'Try again', onPress: () => void me.refetch() }}
            style={styles.centered}
          />
        ) : (
          <ActivityIndicator color={Palette.coral} style={styles.centered} />
        )}
      </SafeAreaView>
    );
  }
  // Keyed so a profile that changes elsewhere starts a fresh draft
  return <EditProfileForm key={me.data.id} profile={me.data} />;
}

function EditProfileForm({ profile }: { profile: ProfileResponse }) {
  const queryClient = useQueryClient();
  const avatarUpload = usePhotoUpload('avatar');
  const [draft, setDraft] = useState<ProfileDraft & { avatar?: PickedPhoto | null }>({
    firstName: profile.firstName,
    lastName: profile.lastName,
  });
  const [preparing, setPreparing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const firstNameError = nameError(draft.firstName, true);
  const lastNameError = nameError(draft.lastName, false);
  const dirty = hasChanges(profile, draft);

  const save = useMutation({
    // The screen shows its own toasts, including for a failed upload
    meta: { toast: false },
    mutationFn: async () => {
      let avatarKey: string | null | undefined;
      if (draft.avatar) {
        const [uploaded] = (await avatarUpload.upload([draft.avatar])) ?? [];
        if (!uploaded) throw new AvatarUploadError();
        avatarKey = uploaded.s3Key;
      } else if (draft.avatar === null) {
        avatarKey = null;
      }
      return updateMe({ ...nameChanges(profile, draft), ...(avatarKey !== undefined && { avatarKey }) });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(profileKeys.me, updated);
      // Your name and avatar are inside every trip, post, story and list you
      // appear in, so refetch everything rather than chase each cache entry.
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      showToast({ message: 'Profile updated', variant: 'success' });
      leave();
    },
    onError: (error) => {
      const message = error instanceof AvatarUploadError ? "Couldn't upload your photo. Try again." : getErrorMessage(error);
      showToast({ message, variant: 'error' });
    },
  });

  const busy = save.isPending || preparing;

  function leave() {
    if (router.canGoBack()) router.back();
    else router.navigate('/profile');
  }

  function confirmLeave() {
    if (!dirty || save.isSuccess) return leave();
    Alert.alert('Discard changes?', "Your edits won't be saved.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: leave },
    ]);
  }

  async function applyPicked(pick: () => Promise<PickPhotoResult>) {
    const result = await pick();
    if (result.status === 'denied') {
      showToast({ message: 'Allow photo access in Settings to change your photo.', variant: 'error' });
      return;
    }
    if (result.status !== 'picked') return;
    setPreparing(true);
    try {
      const photo = await preparePhoto(result.photo, { square: true });
      setDraft((current) => ({ ...current, avatar: photo }));
    } catch {
      showToast({ message: "Couldn't use that photo. Try another one.", variant: 'error' });
    } finally {
      setPreparing(false);
    }
  }

  function changePhoto() {
    const hasPhoto = draft.avatar === undefined ? Boolean(profile.avatarUrl) : draft.avatar !== null;
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => void applyPicked(() => takePhoto({ square: true })) },
      { text: 'Choose from library', onPress: () => void applyPicked(() => choosePhoto({ square: true })) },
      ...(hasPhoto
        ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => setDraft((d) => ({ ...d, avatar: null })) }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function submit() {
    setShowErrors(true);
    if (firstNameError || lastNameError || !dirty || busy) return;
    save.mutate();
  }

  const avatarUri = draft.avatar === undefined ? profile.avatarUrl : (draft.avatar?.uri ?? null);
  const name = `${draft.firstName} ${draft.lastName}`.trim() || profile.username;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <BackBar
        title="Edit profile"
        onBack={confirmLeave}
        right={
          <Button title="Save" size="compact" onPress={submit} loading={save.isPending} disabled={!dirty || preparing} />
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              disabled={busy}
              onPress={changePhoto}
              style={styles.avatarButton}>
              <Avatar name={name} uri={avatarUri} size="large" />
              <View style={styles.cameraBadge}>
                {preparing ? <ActivityIndicator color={Palette.white} size="small" /> : <Icon name="camera" size={Spacing.three} color="white" />}
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={changePhoto} hitSlop={Spacing.two}>
              <AppText variant="label" color="coral">
                Change photo
              </AppText>
            </Pressable>
            {save.isPending && avatarUpload.state === 'uploading' ? (
              <AppText variant="caption" color="placeholderGray">
                Uploading photo · {Math.round(avatarUpload.progress * 100)}%
              </AppText>
            ) : null}
          </View>

          <View style={styles.card}>
            <AppText variant="caption" color="placeholderGray">
              @{profile.username}
            </AppText>
            <Input
              label="First name"
              value={draft.firstName}
              onChangeText={(firstName) => setDraft((d) => ({ ...d, firstName }))}
              error={showErrors ? firstNameError : undefined}
              maxLength={MAX_NAME_LENGTH + 10}
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              editable={!save.isPending}
            />
            <Input
              label="Last name"
              value={draft.lastName}
              onChangeText={(lastName) => setDraft((d) => ({ ...d, lastName }))}
              error={showErrors ? lastNameError : undefined}
              maxLength={MAX_NAME_LENGTH + 10}
              autoComplete="family-name"
              textContentType="familyName"
              returnKeyType="done"
              onSubmitEditing={submit}
              editable={!save.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite },
  flex: { flex: 1 },
  centered: { alignSelf: 'center', marginTop: Spacing.six },
  content: { padding: Spacing.three, gap: Spacing.four },
  avatarBlock: { alignItems: 'center', gap: Spacing.two },
  avatarButton: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    right: -Spacing.half,
    bottom: -Spacing.half,
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.coral,
    borderWidth: 2,
    borderColor: Palette.warmWhite,
  },
  card: {
    backgroundColor: Palette.white,
    borderColor: Palette.peach,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.pill,
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
