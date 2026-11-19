import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';
import type { TripResponse } from 'shared-types';

import { showToast } from '@/lib/toast';
import { tripShareContent } from '@/lib/trip-page';

/**
 * Opens the native share sheet with a link to the trip page. The link uses the
 * app's scheme (`exp://…` in Expo Go) until the app has a web domain.
 */
export function shareTrip(trip: Pick<TripResponse, 'id' | 'title' | 'destination'>) {
  const url = Linking.createURL(`/trips/${trip.id}`);
  Share.share(tripShareContent(trip, url, Platform.OS)).catch((error: unknown) => {
    // Closing the browser's share sheet rejects with AbortError; that's not a failure
    if (error instanceof Error && error.name === 'AbortError') return;
    // e.g. a browser without navigator.share
    showToast({ message: "Sharing isn't available here. Try on your phone." });
  });
}
