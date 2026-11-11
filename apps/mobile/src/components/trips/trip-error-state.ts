import { router } from 'expo-router';

import { ApiError, getErrorMessage } from '@/api/client';
import type { EmptyStateProps } from '@/components/ui/empty-state';
import { TRIP_ERROR_FALLBACKS } from '@/lib/trips';

// `Screen`'s errorState for the trip screens. A deleted trip (or someone
// else's draft) can't come back with a retry, so it offers Go back instead.
export function tripErrorState(error: unknown): Partial<EmptyStateProps> {
  if (error instanceof ApiError && error.status === 404) {
    return {
      icon: 'map-outline',
      title: 'Trip not found',
      description: TRIP_ERROR_FALLBACKS[404],
      action: { title: 'Go back', onPress: () => router.back() },
    };
  }
  return {
    title: "Couldn't load this trip",
    description: getErrorMessage(error, TRIP_ERROR_FALLBACKS),
  };
}
