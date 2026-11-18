import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';
import type { TripResponse } from 'shared-types';

import { tripShareContent } from '@/lib/trip-page';

/**
 * Opens the native share sheet with a link to the trip page. The link uses the
 * app's scheme (`exp://…` in Expo Go) until the app has a web domain.
 */
export function shareTrip(trip: Pick<TripResponse, 'id' | 'title' | 'destination'>) {
  const url = Linking.createURL(`/trips/${trip.id}`);
  void Share.share(tripShareContent(trip, url, Platform.OS));
}
