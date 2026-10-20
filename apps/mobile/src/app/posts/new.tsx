import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/query-keys';
import type { TripResponse } from '@/api/types';
import { LocationPicker, type PickedLocation } from '@/components/location/location-picker';
import { PhotoGrid } from '@/components/posts/photo-grid';
import { TripSelect } from '@/components/posts/trip-select';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast-provider';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';
import { useMyTrips } from '@/hooks/use-trips';
import { useCurrentUser } from '@/lib/current-user';
import { choosePhotos } from '@/lib/media/pick-photos';
import { preparePhoto } from '@/lib/media/prepare-photo';
import { deleteDraft, getDraft, listDrafts, newDraftId, type DraftPhoto, type PostDraft } from '@/lib/post-drafts';
import { defaultVisitedOn, POST_LIMITS, suggestTrip, validatePostForm, type PostFormErrors } from '@/lib/post-form';
import { isDraftInFlight, submitPostDraft, type UploadProgress } from '@/lib/post-upload';
import { charCount } from '@/lib/trip-form';
import { todayLocalIso } from '@/utils/local-date';
import { formatWeekdayDate, tripDayNumber, tripDays } from '@/utils/trip-dates';

type Params = { tripId?: string; visitedOn?: string; draftId?: string };

export default function NewPostScreen() {
  const params = useLocalSearchParams<Params>();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const [today] = useState(todayLocalIso);
  const { data: trips = [], isLoading: tripsLoading } = useMyTrips();

  const [draftId, setDraftId] = useState(() => params.draftId ?? newDraftId());
  const [tripId, setTripId] = useState<string | null>(params.tripId ?? null);
  const [visitedOn, setVisitedOn] = useState<string | null>(params.visitedOn ?? null);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [caption, setCaption] = useState('');
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [failedDraft, setFailedDraft] = useState<PostDraft | null>(null);
  const [errors, setErrors] = useState<PostFormErrors>({});
  const [confirmClose, setConfirmClose] = useState(false);

  // No trip passed in (Create tab): suggest one until the user picks
  const trip: TripResponse | null = tripId
    ? (trips.find((t) => t.id === tripId) ?? null)
    : suggestTrip(trips, today);
  const day = trip ? defaultVisitedOn(trip, today, visitedOn) : null;
  const uploading = progress !== null;

  // Bring back a saved draft: the one asked for, or the newest stuck one for this trip
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = params.draftId
        ? await getDraft(params.draftId)
        : params.tripId
          ? ((await listDrafts())
              .filter((d) => d.tripId === params.tripId && !isDraftInFlight(d.id))
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null)
          : null;
      if (!draft || cancelled) return;
      setDraftId(draft.id);
      setTripId(draft.tripId);
      setVisitedOn(draft.visitedOn);
      setPhotos(draft.photos);
      setLocation(draft.location);
      setCaption(draft.caption);
      setFailedDraft(draft);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.draftId, params.tripId]);

  const close = () => {
    if (router.canGoBack()) router.back();
  };

  const addPhotos = async () => {
    setAddingPhotos(true);
    try {
      const result = await choosePhotos(POST_LIMITS.media - photos.length);
      if (result.status === 'denied') {
        showToast({ message: 'Allow photo access in Settings to add photos.', variant: 'error' });
        return;
      }
      if (result.status === 'canceled') return;
      // Resize before saving so drafts and uploads use the small JPEG (DOC-1).
      // A photo that can't be converted is left out: the server only takes JPEG.
      const prepared = await Promise.all(
        result.photos.map((photo) => preparePhoto(photo).catch(() => null)),
      );
      const ok = prepared.filter((p) => p !== null);
      if (ok.length < prepared.length) {
        const skipped = prepared.length - ok.length;
        showToast({
          message: `Couldn't add ${skipped} ${skipped === 1 ? 'photo' : 'photos'}.`,
          variant: 'error',
        });
      }
      setPhotos((current) =>
        [...current, ...ok.map((p) => ({ ...p, s3Key: null }))].slice(0, POST_LIMITS.media),
      );
      setErrors(({ photos: _photos, ...rest }) => rest);
    } finally {
      setAddingPhotos(false);
    }
  };

  const submit = async () => {
    const nextErrors = validatePostForm({ trip, photoCount: photos.length, location, caption });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !trip || !day || !location) return;

    setFailedDraft(null);
    const result = await submitPostDraft(
      {
        id: draftId,
        tripId: trip.id,
        visitedOn: day,
        caption,
        location,
        photos,
        status: 'uploading',
        error: null,
        updatedAt: new Date().toISOString(),
      },
      (next) => setProgress(next),
    );
    setProgress(null);

    if (result.status === 'failed') {
      setPhotos(result.draft.photos);
      setFailedDraft(result.draft);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.tripPosts(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.userTrips(user.id) });
    showToast({ message: 'Post added', variant: 'success' });
    close();
  };

  const discardDraft = async () => {
    await deleteDraft(draftId);
    close();
  };

  const captionLength = charCount(caption.trim());
  const photoState = (photo: DraftPhoto) =>
    photo.s3Key ? ('uploaded' as const) : failedDraft ? ('failed' as const) : uploading ? ('pending' as const) : undefined;

  return (
    <Screen>
      <ScreenHeader
        title="Add post"
        left={{
          icon: 'close',
          label: 'Close',
          onPress: () => (photos.length > 0 && !failedDraft && !uploading ? setConfirmClose(true) : close()),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled">
          {failedDraft ? (
            <View style={styles.banner} accessibilityLiveRegion="polite">
              <AppText variant="label">
                {failedDraft.error ?? "Couldn't upload this post."} Your post is saved as a draft.
              </AppText>
              {/* Retry is the main button at the bottom */}
              <Pressable
                accessibilityRole="button"
                disabled={uploading}
                hitSlop={Spacing.two}
                onPress={() => void discardDraft()}
                style={styles.discard}>
                <AppText variant="label" style={styles.discardText}>
                  Discard draft
                </AppText>
              </Pressable>
            </View>
          ) : null}

          <Section label="Trip" error={errors.trip}>
            <TripSelect
              trip={trip}
              subtitle={trip && day ? `Day ${tripDayNumber(trip.startDate, day)} · ${formatWeekdayDate(day)}` : ''}
              trips={trips}
              loading={tripsLoading}
              disabled={uploading}
              onChange={(next) => {
                setTripId(next.id);
                setVisitedOn(null);
                setErrors(({ trip: _trip, ...rest }) => rest);
              }}
              onCreateTrip={() => router.push('/trips/new')}
            />
          </Section>

          {trip ? (
            <Section label="Choose trip day">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {tripDays(trip.startDate, trip.endDate).map((date, index) => (
                  <Pill
                    key={date}
                    label={`Day ${index + 1}`}
                    accessibilityLabel={`Day ${index + 1}, ${formatWeekdayDate(date)}`}
                    state={date === day ? 'selected' : 'default'}
                    onPress={uploading ? undefined : () => setVisitedOn(date)}
                  />
                ))}
              </ScrollView>
            </Section>
          ) : null}

          <Section
            label="Photos"
            aside={`${photos.length} / ${POST_LIMITS.media}`}
            error={errors.photos}>
            <PhotoGrid
              photos={photos.map((photo) => ({ uri: photo.uri, state: photoState(photo) }))}
              max={POST_LIMITS.media}
              adding={addingPhotos}
              disabled={uploading}
              onAdd={() => void addPhotos()}
              onRemove={(index) => setPhotos((current) => current.filter((_, i) => i !== index))}
            />
          </Section>

          <Section label="Location" error={errors.location}>
            <LocationPicker
              label=""
              value={location}
              onChange={(next) => {
                setLocation(next);
                if (next) setErrors(({ location: _location, ...rest }) => rest);
              }}
            />
          </Section>

          <Section
            label="Caption"
            aside={`${captionLength.toLocaleString('en-US')} / ${POST_LIMITS.caption.toLocaleString('en-US')}`}>
            <Input
              value={caption}
              onChangeText={setCaption}
              placeholder="What happened here? (optional)"
              accessibilityLabel="Caption"
              multiline
              editable={!uploading}
              error={errors.caption}
              style={styles.caption}
            />
          </Section>

          <View style={styles.note}>
            <AppText variant="caption">Nothing is posted until every photo has uploaded.</AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {progress ? (
          <AppText variant="caption" accessibilityLiveRegion="polite" style={styles.progress}>
            {progress.creating
              ? 'Saving post…'
              : `Uploading photo ${progress.current} of ${progress.total} (${Math.round(progress.fraction * 100)}%)`}
          </AppText>
        ) : null}
        <Button
          title={failedDraft ? 'Retry upload' : 'Add post'}
          loading={uploading}
          onPress={() => void submit()}
          style={styles.submit}
        />
      </View>

      <ConfirmDialog
        visible={confirmClose}
        title="Discard this post?"
        message="Your photos and caption won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmClose(false);
          close();
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </Screen>
  );
}

type SectionProps = {
  label: string;
  aside?: string;
  error?: string;
  children: ReactNode;
};

// Left-aligned section label from the Add posts wireframe
function Section({ label, aside, error, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="caption" style={styles.sectionLabel}>
          {label}
        </AppText>
        {aside ? (
          <AppText variant="caption" style={styles.sectionLabel}>
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
  sectionLabel: { color: Palette.placeholderGray },
  error: { color: Palette.coral },
  days: { gap: 6 },
  caption: { minHeight: 88, textAlignVertical: 'top' },
  note: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radii.small,
    backgroundColor: Palette.peach,
  },
  banner: {
    gap: Spacing.two,
    padding: Spacing.three - Spacing.one,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Palette.coral,
    backgroundColor: Palette.peach,
  },
  discard: { alignSelf: 'flex-start' },
  discardText: { color: Palette.coral },
  footer: { gap: Spacing.two },
  progress: { textAlign: 'center', color: Palette.placeholderGray },
  submit: { width: '100%' },
});
