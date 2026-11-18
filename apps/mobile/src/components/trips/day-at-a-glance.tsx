import { StyleSheet, View } from 'react-native';

import { THUMB } from '@/components/trips/day-posts';
import { AppText } from '@/components/ui/app-text';
import { Media } from '@/components/ui/media';
import { Pill } from '@/components/ui/pill';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';
import type { DayPlace } from '@/lib/trip-page';

// "The day, at a glance": the day's places in visit order (from `dayPlaces`),
// above its posts. Not tappable until there's a place page to open. Saving a
// place comes with PLACE-2's Save sheet (#139).
export function DayAtAGlance({ places }: { places: DayPlace[] }) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <AppText variant="subheading" style={styles.flex}>
          The day, at a glance
        </AppText>
        <Pill label={places.length === 1 ? '1 stop' : `${places.length} stops`} />
      </View>
      {places.map((place, i) => (
        <View
          key={place.key}
          style={styles.row}
          accessible
          accessibilityLabel={`Stop ${i + 1}, ${place.name}${place.subtitle ? `, ${place.subtitle}` : ''}`}>
          <AppText variant="caption" style={[styles.muted, styles.number]}>
            {i + 1}
          </AppText>
          {place.coverUrl ? (
            <Media seed={place.coverSeed} url={place.coverUrl} iconSize={Spacing.three} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
          <View style={styles.flex}>
            <AppText variant="label" numberOfLines={1}>
              {place.name}
            </AppText>
            <AppText variant="caption" numberOfLines={1} style={styles.muted}>
              {[place.subtitle, place.postCount === 1 ? '1 post' : `${place.postCount} posts`]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.peach,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: THUMB },
  number: { minWidth: Spacing.three, textAlign: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radii.small },
  thumbEmpty: { backgroundColor: Palette.lightPink },
  muted: { color: Palette.placeholderGray },
});
