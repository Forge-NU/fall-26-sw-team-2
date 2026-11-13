import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Area, Audience, Place, Stats } from '@/components/explore/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { MapTokens } from '@/constants/map-tokens';
import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { formatCount } from '@/utils/format-count';

interface BodyProps {
  place: Place;
  area: Area;
  audience: Audience;
  onClose: () => void;
}

/** Splits an average into whole-star counts that add up to `reviews`, 5 stars first. */
function ratingCounts(st: Stats): number[] {
  const counts = [0, 0, 0, 0, 0];
  const r = Math.max(1, Math.min(5, st.rating));
  const low = Math.floor(r);
  if (low >= 5) {
    counts[0] = st.reviews;
    return counts;
  }
  const high = Math.round(st.reviews * (r - low));
  counts[5 - (low + 1)] = high;
  counts[5 - low] = st.reviews - high;
  return counts;
}

const RATINGS_LABEL: Record<Audience, (n: number) => string> = {
  me: () => 'Your rating',
  friends: (n) => `${n} friend ${n === 1 ? 'rating' : 'ratings'}`,
  global: (n) => `${formatCount(n)} ratings`,
};

export function PlaceDetailBody({ place, area, audience, onClose }: BodyProps) {
  const [sortBy, setSortBy] = useState<'saves' | 'reviews'>('saves');

  const own = place.stats[audience];
  const ratingStats = own.reviews > 0 ? own : place.stats.global;
  const ratingsLabel = own.reviews > 0 ? RATINGS_LABEL[audience](own.reviews) : `${formatCount(ratingStats.reviews)} ratings`;
  const counts = ratingCounts(ratingStats);
  const people = [...place.people].sort((a, b) => b[sortBy] - a[sortBy]);
  const friendCount = place.stats.friends.people;
  const named = place.friendNames.slice(0, 2);
  const others = friendCount - named.length;
  const visitedLine =
    others > 0
      ? `${named.join(', ')} + ${others} ${others === 1 ? 'friend' : 'friends'} visited`
      : `${named.join(' and ')} visited`;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{place.name}</Text>
          <Text style={styles.meta}>
            {place.type} · {place.neighborhood}, {area.name}
          </Text>
          <Text style={styles.logs}>
            {place.stats.friends.logs} friend logs · {formatCount(place.stats.global.logs)} global logs
          </Text>
        </View>
        <IconButton icon="x" accessibilityLabel="Close" onPress={onClose} style={styles.close} />
      </View>

      {place.tip && (
        <View style={styles.tip}>
          <Text style={styles.tipText}>
            {place.tip.text}. {place.tip.author}’s tip for this {place.type.toLowerCase()}.
          </Text>
          <Text style={styles.tipSource}>From {place.tip.author}’s shared note</Text>
        </View>
      )}

      <View style={styles.ratingCard}>
        <View style={styles.ratingBig}>
          <Text style={styles.ratingValue}>{ratingStats.rating.toFixed(1)}</Text>
          <Text style={styles.ratingOutOf}>out of 5</Text>
        </View>
        <View style={styles.bars}>
          <Text style={styles.barsLabel}>{ratingsLabel}</Text>
          {counts.map((n, i) => (
            <View key={i} style={styles.barRow}>
              <Text style={styles.barStar}>{5 - i}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { width: `${ratingStats.reviews ? (n / ratingStats.reviews) * 100 : 0}%` }]}
                />
              </View>
              <Text style={styles.barCount}>{n}</Text>
            </View>
          ))}
        </View>
      </View>

      {place.photos.length > 0 && (
        <>
          <Text style={styles.section}>Most-saved photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {place.photos.map((ph) => (
              <View key={ph.id}>
                <Image source={{ uri: ph.uri }} style={styles.photo} accessibilityLabel={`Photo of ${place.name}`} />
                <Text style={styles.photoSaves}>{formatCount(ph.saves)} saves</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {people.length > 0 && (
        <>
          <Text style={styles.section}>People who logged this</Text>
          <View style={styles.sortRow}>
            {(['saves', 'reviews'] as const).map((key) => (
              <Pill
                key={key}
                label={key === 'saves' ? 'Most saves' : 'Most reviews'}
                state={key === sortBy ? 'selected' : 'default'}
                onPress={() => setSortBy(key)}
              />
            ))}
          </View>
          <View style={styles.people}>
            {people.map((pr) => (
              <View key={pr.id} style={styles.person}>
                <Avatar name={pr.name} size="medium" />
                <View style={styles.personText}>
                  <View style={styles.personTop}>
                    <Text style={styles.personName}>{pr.name}</Text>
                    <Text style={styles.personStats}>
                      {pr.saves} saves · {pr.reviews} reviews
                    </Text>
                  </View>
                  <Text style={styles.personTrip} numberOfLines={1}>
                    {pr.trip.location} · {pr.trip.title}
                  </Text>
                </View>
                {/* "View trip ›" comes back with MAP-3 (#47), once people and trips are real */}
              </View>
            ))}
          </View>
        </>
      )}

      {place.quote && (
        <Text style={styles.quote}>
          “{place.quote.text}” — {place.quote.author}
        </Text>
      )}
      {named.length > 0 && <Text style={styles.visited}>{visitedLine}</Text>}
    </ScrollView>
  );
}

interface ActionProps {
  saved: boolean;
  onLogVisit: () => void;
  onToggleSave: () => void;
}

export function PlaceActions({ saved, onLogVisit, onToggleSave }: ActionProps) {
  return (
    <View style={styles.actions}>
      <Button title="+ Log a visit" filled onPress={onLogVisit} style={styles.action} />
      <Button
        title={saved ? 'Saved' : 'Save place'}
        variant="teal"
        filled={saved}
        onPress={onToggleSave}
        accessibilityState={{ selected: saved }}
        style={styles.action}
      />
    </View>
  );
}

const muted = { ...Typography.label, fontFamily: Typography.body.fontFamily, color: Palette.placeholderGray };
const small = { ...Typography.caption, fontFamily: Typography.body.fontFamily, color: Palette.placeholderGray };

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.three },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  titleBlock: { flex: 1, gap: Spacing.one },
  title: { ...Typography.heading, color: Palette.black },
  meta: { ...Typography.body, color: Palette.placeholderGray },
  logs: { ...Typography.label, color: Palette.black },
  close: { marginRight: -Spacing.two },
  tip: { padding: Spacing.three, gap: Spacing.one, borderRadius: Radii.pill, backgroundColor: Palette.lightTeal },
  tipText: { ...Typography.label, fontFamily: Typography.body.fontFamily, color: Palette.black },
  tipSource: small,
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.peach,
  },
  ratingBig: { alignItems: 'center', minWidth: MapTokens.ratingWidth },
  ratingValue: { ...Typography.heading, fontSize: MapTokens.ratingSize, lineHeight: MapTokens.ratingLineHeight, color: Palette.black },
  ratingOutOf: small,
  bars: { flex: 1, gap: Spacing.half },
  barsLabel: { ...small, marginBottom: Spacing.half },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barStar: { ...small, width: Spacing.three - Spacing.one },
  barTrack: { flex: 1, height: MapTokens.barHeight, borderRadius: Radii.circle, backgroundColor: Palette.peach, overflow: 'hidden' },
  barFill: { height: MapTokens.barHeight, borderRadius: Radii.circle, backgroundColor: Palette.teal },
  barCount: { ...small, width: Spacing.four + Spacing.one, textAlign: 'right' },
  section: { ...Typography.subheading, color: Palette.black, marginTop: Spacing.one },
  photos: { gap: Spacing.two },
  photo: { width: MapTokens.photo.width, height: MapTokens.photo.height, borderRadius: Radii.medium, backgroundColor: Palette.peach },
  photoSaves: { ...small, marginTop: Spacing.one },
  sortRow: { flexDirection: 'row', gap: Spacing.two },
  people: { gap: Spacing.two },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.peach,
  },
  personText: { flex: 1, gap: Spacing.half },
  personTop: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' },
  personName: { ...Typography.label, color: Palette.black },
  personStats: { ...Typography.caption, color: Palette.black },
  personTrip: muted,
  quote: { ...Typography.label, fontFamily: Typography.body.fontFamily, color: Palette.black },
  visited: { ...small, marginTop: -Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1, minWidth: 0 },
});
