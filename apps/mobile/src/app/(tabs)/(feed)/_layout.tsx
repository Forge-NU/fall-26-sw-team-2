import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

/** Feed tab stack. Trips open on the shared trip page (`/trips/[id]`), outside the tabs. */
export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.warmWhite } }}
    />
  );
}
