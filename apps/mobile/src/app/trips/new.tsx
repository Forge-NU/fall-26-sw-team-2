import { router } from 'expo-router';

import { TripForm } from '@/components/trips/trip-form';
import { useToast } from '@/components/ui/toast-provider';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useCreateTrip } from '@/hooks/use-trips';
import { describeError } from '@/lib/api-errors';
import { toCreateTripRequest } from '@/lib/trip-form';
import { todayLocalIso } from '@/utils/local-date';

export default function NewTripScreen() {
  const createTrip = useCreateTrip();
  const { showToast } = useToast();

  return (
    <Screen>
      <ScreenHeader
        title="New trip"
        left={{ icon: 'close', label: 'Close', onPress: () => router.back() }}
      />
      <TripForm
        initialValues={{
          title: '',
          destination: '',
          description: '',
          startDate: todayLocalIso(),
          endDate: null,
        }}
        submitLabel="Create trip"
        submitting={createTrip.isPending}
        formError={createTrip.error ? describeError(createTrip.error, "Couldn't create the trip. Try again.") : null}
        onSubmit={(values) =>
          createTrip.mutate(toCreateTripRequest(values), {
            onSuccess: (trip) => {
              showToast({ message: 'Trip created', variant: 'success' });
              router.back();
              router.push({ pathname: '/trips/[id]', params: { id: trip.id } });
            },
          })
        }
      />
    </Screen>
  );
}
