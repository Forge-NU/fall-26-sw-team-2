import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { getErrorMessage } from '@/api/client';
import { TripForm } from '@/components/trips/trip-form';
import { tripErrorState } from '@/components/trips/trip-error-state';
import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast-provider';
import { Palette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useDeleteTrip, useTrip, useTripPosts, useUpdateTrip } from '@/hooks/use-trips';
import { toUpdateTripRequest, type TripFormValues } from '@/lib/trip-form';
import { TRIP_ERROR_FALLBACKS } from '@/lib/trips';

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const posts = useTripPosts(id);
  const updateTrip = useUpdateTrip(id);
  const deleteTrip = useDeleteTrip(id);
  const { showToast } = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const close = () => router.back();

  const error = trip.error ?? posts.error;

  // Screen shows the loading and error states, so this only builds the form
  let body = null;
  if (trip.data && posts.data) {
    const initialValues: TripFormValues = {
      title: trip.data.title,
      destination: trip.data.destination,
      description: trip.data.description ?? '',
      startDate: trip.data.startDate,
      endDate: trip.data.endDate,
    };
    const postCount = posts.data.length;

    body = (
      <>
        <TripForm
          initialValues={initialValues}
          postDates={posts.data.map((post) => post.visitedOn)}
          submitLabel="Save changes"
          submitting={updateTrip.isPending}
          formError={updateTrip.error ? getErrorMessage(updateTrip.error, { ...TRIP_ERROR_FALLBACKS, other: "Couldn't save your changes. Try again." }) : null}
          onSubmit={(values) => {
            const changes = toUpdateTripRequest(initialValues, values);
            if (Object.keys(changes).length === 0) return close();
            updateTrip.mutate(changes, {
              onSuccess: () => {
                showToast({ message: 'Trip updated', variant: 'success' });
                close();
              },
            });
          }}
          footer={
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmingDelete(true)}
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
              <AppText variant="label" style={styles.deleteText}>
                Delete trip
              </AppText>
            </Pressable>
          }
        />
        <ConfirmDialog
          visible={confirmingDelete}
          title="Delete this trip?"
          message={
            postCount > 0
              ? `"${trip.data.title}" and its ${postCount} ${postCount === 1 ? 'post' : 'posts'} will be deleted for good. You can't undo this.`
              : `"${trip.data.title}" will be deleted for good. You can't undo this.`
          }
          confirmLabel="Delete trip"
          destructive
          loading={deleteTrip.isPending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() =>
            deleteTrip.mutate(undefined, {
              onSuccess: () => {
                setConfirmingDelete(false);
                showToast({ message: 'Trip deleted', variant: 'success' });
                // Close this sheet and the deleted trip's page
                router.dismissAll();
              },
              onError: (error) => {
                setConfirmingDelete(false);
                showToast({ message: getErrorMessage(error, { ...TRIP_ERROR_FALLBACKS, other: "Couldn't delete the trip. Try again." }), variant: 'error' });
              },
            })
          }
        />
      </>
    );
  }

  return (
    <Screen
      loading={trip.isPending || posts.isPending}
      error={error}
      onRetry={() => {
        void trip.refetch();
        void posts.refetch();
      }}
      errorState={tripErrorState(error)}
      header={
        <ScreenHeader title="Edit trip" left={{ icon: 'x', label: 'Close', onPress: close }} />
      }>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  delete: { alignSelf: 'center', paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  deleteText: { color: Palette.coral },
  pressed: { opacity: 0.6 },
});
