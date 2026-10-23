import { Pressable, StyleSheet, View } from 'react-native';
import type { TripResponse } from 'shared-types';

import { formatDateRange } from '@/components/content/format-date';
import { Icon } from '@/components/icon';
import { AppText } from '@/components/ui/app-text';
import { Media } from '@/components/ui/media';
import { Palette, Radii, Spacing } from '@/constants/theme';

/**
 * One itinerary on a profile: cover, destination, spot count. Drafts get a coral badge.
 * Not pressable until TRIP-2 (#64) adds a trip screen that loads real trips.
 */
export function TripRow({ trip, onPress }: { trip: TripResponse; onPress?: () => void }) {
  const draft = trip.status === 'draft';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${trip.title}, ${trip.destination}, ${trip.postCount} spots${draft ? ', draft' : ''}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Media seed={trip.id} url={trip.coverImageUrl ?? undefined} style={styles.cover} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText variant="label" numberOfLines={1} style={styles.title}>
            {trip.destination}
          </AppText>
          {draft && (
            <View style={styles.draft}>
              <AppText variant="caption" color="coral">
                Draft
              </AppText>
            </View>
          )}
        </View>
        <AppText variant="caption" color="placeholderGray" numberOfLines={1}>
          {trip.title !== trip.destination ? `${trip.title} · ` : ''}
          {formatDateRange(trip.startDate, trip.endDate)}
        </AppText>
      </View>
      <AppText variant="caption" color="placeholderGray">
        {trip.postCount} {trip.postCount === 1 ? 'spot' : 'spots'}
      </AppText>
      {onPress && <Icon name="chevron-right" color="placeholderGray" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    backgroundColor: Palette.white,
    borderColor: Palette.peach,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.pill,
  },
  pressed: { backgroundColor: Palette.peach },
  cover: { width: Spacing.five + Spacing.three, height: Spacing.five + Spacing.three, borderRadius: Radii.medium },
  copy: { flex: 1, minWidth: 0, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flexShrink: 1 },
  draft: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radii.circle,
    backgroundColor: Palette.peach,
  },
});
