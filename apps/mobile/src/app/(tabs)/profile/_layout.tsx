import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

/** Profile tab stack: your profile plus the profiles and follow lists pushed from it. */
export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.warmWhite } }}
    />
  );
}
