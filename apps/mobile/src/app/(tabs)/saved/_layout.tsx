import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

/** Saved tab stack. Post detail and its likes list sit on the root stack, so they cover the tabs. */
export default function SavedLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.warmWhite } }}
    />
  );
}
