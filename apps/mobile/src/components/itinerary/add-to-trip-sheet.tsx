import { Alert } from 'react-native';

import { TripChooserSheet } from '@/components/trip-chooser-sheet';
import { useToast } from '@/components/ui/toast-provider';
import { UnpublishedTrips, type ActiveTrip } from '@/data/mock';
import { isWithin, toIsoDate } from '@/utils/dates';

type AddToTripSheetProps = {
  visible: boolean;
  /** How many places are being added, for the confirmation toast. */
  placeCount: number;
  onAdded?: (trip: ActiveTrip) => void;
  onClose: () => void;
};

function tripStatus(trip: ActiveTrip) {
  const today = toIsoDate(new Date());
  if (isWithin(today, trip.startDate, trip.endDate)) return 'In progress';
  return today < trip.startDate ? 'Upcoming' : 'Ended';
}

/** Choose which of your unpublished trips a place (or a whole day) gets added to. */
export function AddToTripSheet({ visible, placeCount, onAdded, onClose }: AddToTripSheetProps) {
  const { showToast } = useToast();

  return (
    <TripChooserSheet
      visible={visible}
      title="Add to a trip"
      trips={UnpublishedTrips}
      selectedId={null}
      describe={tripStatus}
      onSelect={(tripId) => {
        const trip = UnpublishedTrips.find((t) => t.id === tripId);
        if (!trip) return;
        onClose();
        onAdded?.(trip);
        // Mock only: nothing is saved until the itinerary endpoints exist.
        showToast({
          message: `Added ${placeCount} ${placeCount === 1 ? 'place' : 'places'} to ${trip.title}`,
          variant: 'success',
        });
      }}
      onCreateTrip={() => {
        onClose();
        Alert.alert('Create trip', 'Trip creation is coming in a later wireframe.');
      }}
      onClose={onClose}
    />
  );
}
