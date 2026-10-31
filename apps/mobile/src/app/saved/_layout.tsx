import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

/** Saved tab stack: your saved trips and posts, plus the likes lists pushed from them. */
export default function SavedLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.warmWhite } }}
    />
  );
}
