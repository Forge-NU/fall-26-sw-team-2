import { router } from 'expo-router';

import { ApiError, getErrorMessage } from '@/api/client';
import type { EmptyStateProps } from '@/components/ui/empty-state';
import { TRIP_ERROR_FALLBACKS } from '@/lib/trips';

/** Back, or the feed when the trip screen was opened directly (e.g. a shared link). */
export function leaveTrip() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}

// `Screen`'s errorState for the trip screens. A deleted trip (or someone
// else's draft) can't come back with a retry, so it offers Go back instead.
// So does a 400: loading a trip only gets one for an id that isn't a UUID
// (a bad link, or a mock feed card until FEED-2 #27), which no retry fixes.
export function tripErrorState(error: unknown): Partial<EmptyStateProps> {
  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return {
      icon: 'map-outline',
      title: 'Trip not found',
      description: TRIP_ERROR_FALLBACKS[404],
      action: { title: 'Go back', onPress: leaveTrip },
    };
  }
  return {
    title: "Couldn't load this trip",
    description: getErrorMessage(error, TRIP_ERROR_FALLBACKS),
  };
}
