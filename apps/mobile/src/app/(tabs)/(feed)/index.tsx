import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { TripCard } from '@/components/content/trip-card';
import { StoriesRow } from '@/components/feed/stories-row';
import { Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { YujiHeader } from '@/components/yuji-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { feedTrips, type FeedTrip } from '@/data/feed-trips';
import type { FeedTab } from '@/data/mock';

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

function FeedCard({ card }: { card: FeedTrip }) {
  const { trip } = card;
  const openDay = (day: number) =>
    router.push({ pathname: '/itinerary/[id]', params: { id: trip.id, day: String(day) } });

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
      onPress={() => openDay(1)}
      onDaySelect={openDay}
      onShare={() => void Share.share({ message: trip.title })}
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
