import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, formatCount, radius } from '../theme';
import type { Area, Audience, Person, Place, Stats } from '../types';
import { Avatar } from './Avatar';

interface BodyProps {
  place: Place;
  area: Area;
  audience: Audience;
  onClose: () => void;
  onViewTrip: (person: Person) => void;
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

export function PlaceDetailBody({ place, area, audience, onClose, onViewTrip }: BodyProps) {
  const [sortBy, setSortBy] = useState<'saves' | 'reviews'>('saves');

  const own = place.stats[audience];
  const ratingStats = own.reviews > 0 ? own : place.stats.global;
  const ratingsLabel = own.reviews > 0 ? RATINGS_LABEL[audience](own.reviews) : `${formatCount(ratingStats.reviews)} ratings`;
  const counts = ratingCounts(ratingStats);
  const people = [...place.people].sort((a, b) => b[sortBy] - a[sortBy]);
  const friendCount = place.stats.friends.people;
  const named = place.friendNames.slice(0, 2);
  const visitedLine =
    friendCount > named.length ? `${named.join(', ')} + ${friendCount - named.length} friends visited` : `${named.join(' and ')} visited`;

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
        <Pressable onPress={onClose} style={styles.close} hitSlop={8} accessibilityLabel="Close">
          <MaterialCommunityIcons name="close" size={20} color={colors.forest} />
        </Pressable>
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
            {(['saves', 'reviews'] as const).map((key) => {
              const active = key === sortBy;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSortBy(key)}
                  style={[styles.sortBtn, active && styles.sortBtnActive]}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>
                    {key === 'saves' ? 'Most saves' : 'Most reviews'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.people}>
            {people.map((pr) => (
              <View key={pr.id} style={styles.person}>
                <Avatar id={pr.id} name={pr.name} size={44} />
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
                <Pressable style={styles.viewTrip} onPress={() => onViewTrip(pr)}>
                  <Text style={styles.viewTripText}>View trip ›</Text>
                </Pressable>
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
      <Pressable
        style={({ pressed }) => [styles.primary, pressed && { backgroundColor: colors.coralPressed }]}
        onPress={onLogVisit}
      >
        <Text style={styles.primaryText}>+ Log a visit</Text>
      </Pressable>
      <Pressable
        style={[styles.secondary, saved && styles.secondarySaved]}
        onPress={onToggleSave}
        accessibilityState={{ selected: saved }}
      >
        {saved && <MaterialCommunityIcons name="bookmark" size={18} color={colors.forest} />}
        <Text style={styles.secondaryText}>{saved ? 'Saved' : 'Save place'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleBlock: { flex: 1, gap: 4 },
  title: { fontSize: 28, fontWeight: '700', color: colors.forest, letterSpacing: -0.4, lineHeight: 34 },
  meta: { fontSize: 16, color: colors.textMuted, marginTop: 4 },
  logs: { fontSize: 15, color: colors.forest },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sage,
  },
  tip: { padding: 14, gap: 4, borderRadius: radius.md, backgroundColor: colors.sage },
  tipText: { fontSize: 15, color: colors.forest, lineHeight: 20 },
  tipSource: { fontSize: 12, color: colors.textMuted },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  ratingBig: { alignItems: 'center', minWidth: 76 },
  ratingValue: { fontSize: 44, fontWeight: '700', color: colors.forest, letterSpacing: -1 },
  ratingOutOf: { fontSize: 13, color: colors.textMuted },
  bars: { flex: 1, gap: 3 },
  barsLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barStar: { width: 10, fontSize: 11, color: colors.textMuted },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.barTrack, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.sageBar },
  barCount: { width: 26, textAlign: 'right', fontSize: 11, color: colors.textMuted },
  section: { fontSize: 18, fontWeight: '700', color: colors.forest, marginTop: 4 },
  photos: { gap: 10 },
  photo: { width: 160, height: 108, borderRadius: radius.md, backgroundColor: colors.barTrack },
  photoSaves: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
  sortRow: { flexDirection: 'row', gap: 10 },
  sortBtn: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  sortBtnActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  sortText: { fontSize: 15, fontWeight: '600', color: colors.forest },
  sortTextActive: { color: '#FFFFFF' },
  people: { gap: 10 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.sage,
  },
  personText: { flex: 1, gap: 4 },
  personTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  personName: { fontSize: 17, fontWeight: '700', color: colors.forest },
  personStats: { fontSize: 14, color: colors.forest },
  personTrip: { fontSize: 14, color: colors.textMuted },
  viewTrip: {
    paddingHorizontal: 14,
    height: 38,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  viewTripText: { fontSize: 14, fontWeight: '600', color: colors.forest },
  quote: { fontSize: 15, color: colors.text, lineHeight: 21 },
  visited: { fontSize: 13, color: colors.textMuted, marginTop: -6 },
  actions: { flexDirection: 'row', gap: 12 },
  primary: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.coral,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondary: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  secondarySaved: { backgroundColor: colors.sage, borderColor: colors.sage },
  secondaryText: { fontSize: 16, fontWeight: '600', color: colors.forest },
});
