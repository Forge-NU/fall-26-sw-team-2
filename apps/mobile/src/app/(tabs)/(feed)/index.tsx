import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TripCard } from '@/components/content/trip-card';
import { StoriesRow } from '@/components/feed/stories-row';
import { Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { YujiHeader } from '@/components/yuji-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { feedTrips, type FeedTrip } from '@/data/feed-trips';
import type { FeedTab } from '@/data/mock';
import { shareTrip } from '@/lib/share-trip';

const FeedTabs: { key: FeedTab; label: string }[] = [
  { key: 'local', label: 'Local' },
  { key: 'friends', label: 'Friends' },
  { key: 'fyp', label: 'FYP' },
];

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<FeedTab>('fyp');
  const cards = feedTrips(activeTab);

  return (
    <Screen
      edges={['top']}
      gutters={false}
      header={
        <View>
          <YujiHeader />
          <View style={styles.gutter}>
            <TabBar items={FeedTabs} value={activeTab} onChange={setActiveTab} />
          </View>
        </View>
      }>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StoriesRow />
        <View style={styles.stream}>
          {cards.map((card) => (
            <FeedCard key={card.trip.id} card={card} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

// Cards open the shared trip page. Until FEED-2 (#27) replaces the mock trips,
// their ids aren't real trips: the page shows "Couldn't load this trip" (the
// API rejects the id), or "Trip not found" with EXPO_PUBLIC_API_MOCKS=all, and
// Share sends a link that won't open.
function FeedCard({ card }: { card: FeedTrip }) {
  const { trip } = card;
  // `visitedOn` (YYYY-MM-DD) opens the page on that day's tab
  const openTrip = (day?: string) =>
    router.push({ pathname: '/trips/[id]', params: day ? { id: trip.id, day } : { id: trip.id } });

  return (
    <TripCard
      trip={trip}
      dayPreviews={card.dayPreviews}
      meta={card.meta}
      verified={card.verified}
      stops={card.stops}
      // Counts only: the mock trips have no real ids to save. FEED-2 (#27)
      // switches this to tripStats(trip) with the real feed.
      stats={[{ key: 'saves', label: 'saves', icon: 'bookmark', count: trip.saveCount }]}
      caption={card.caption}
      lovedBy={card.lovedBy}
      onPress={() => openTrip()}
      onDayPress={openTrip}
      onShare={() => shareTrip(trip)}
    />
  );
}

const styles = StyleSheet.create({
  gutter: {
    paddingHorizontal: Spacing.three,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  stream: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
});
