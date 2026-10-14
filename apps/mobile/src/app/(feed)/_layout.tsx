import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

/** Feed tab stack: the feed plus the itinerary pages pushed from it. */
export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.surface } }}
    />
  );
}
