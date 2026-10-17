import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { FypStatus } from '@/components/feed/fyp-status';
import { ItineraryCard } from '@/components/feed/itinerary-card';
import { StoriesRow } from '@/components/feed/stories-row';
import { YujiHeader } from '@/components/yuji-header';
import { Palette, ScreenGutter } from '@/constants/theme';
import { FeedTab, Itineraries, Stories } from '@/data/mock';
import { useFypFeed } from '@/hooks/use-fyp-feed';

/** How close to the bottom, in points, the FYP starts loading its next page. */
const LOAD_MORE_DISTANCE = 600;

const FeedTabs: { key: FeedTab; label: string }[] = [
  { key: 'local', label: 'Local' },
  { key: 'friends', label: 'Friends' },
  { key: 'fyp', label: 'FYP' },
];

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<FeedTab>('fyp');
  const fyp = useFypFeed();
  const showingFyp = activeTab === 'fyp';
  // Local and Friends have no endpoints yet, so they still show mock data.
  const itineraries = showingFyp
    ? fyp.itineraries
    : Itineraries.filter((itinerary) => itinerary.feeds.includes(activeTab));

  const loadMoreNearBottom = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_MORE_DISTANCE;
    if (showingFyp && nearBottom) fyp.loadMore();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <YujiHeader />
      <ScrollView
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        onScroll={loadMoreNearBottom}
        scrollEventThrottle={200}
        refreshControl={
          showingFyp ? (
            <RefreshControl
              refreshing={fyp.status === 'refreshing'}
              onRefresh={fyp.refresh}
              tintColor={Palette.teal}
            />
          ) : undefined
        }>
        <View style={styles.intro}>
          <AppText variant="display" size={24} leading={1.1}>
            Find your next trip.
          </AppText>
        </View>

        {/* Sticky headers get their style replaced on native, so the row lives one level down. */}
        <View>
          <View style={styles.tabs} accessibilityRole="tablist">
            {FeedTabs.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveTab(tab.key)}
                  style={styles.tab}>
                  <AppText
                    variant={active ? 'bold' : 'medium'}
                    size={14}
                    color={active ? 'ink' : 'inkMuted'}>
                    {tab.label}
                  </AppText>
                  {active && <View style={styles.tabIndicator} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <StoriesRow stories={Stories} />

        <View style={styles.stream}>
          {itineraries.map((itinerary) => (
            <ItineraryCard key={itinerary.id} itinerary={itinerary} />
          ))}
        </View>
        {showingFyp && <FypStatus feed={fyp} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.surface,
  },
  intro: {
    paddingHorizontal: ScreenGutter,
    paddingVertical: 14,
  },
  tabs: {
    height: 48,
    flexDirection: 'row',
    paddingHorizontal: ScreenGutter,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: Palette.teal,
  },
  stream: {
    gap: 8,
  },
});
