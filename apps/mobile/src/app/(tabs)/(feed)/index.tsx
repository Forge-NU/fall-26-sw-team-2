import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { ItineraryCard } from '@/components/feed/itinerary-card';
import { StoriesRow } from '@/components/feed/stories-row';
import { YujiHeader } from '@/components/yuji-header';
import { Palette, Spacing } from '@/constants/theme';
import { FeedTab, Itineraries, Stories } from '@/data/mock';

const FeedTabs: { key: FeedTab; label: string }[] = [
  { key: 'local', label: 'Local' },
  { key: 'friends', label: 'Friends' },
  { key: 'fyp', label: 'FYP' },
];

export default function FeedScreen() {
  const [activeTab, setActiveTab] = useState<FeedTab>('fyp');
  const itineraries = Itineraries.filter((itinerary) => itinerary.feeds.includes(activeTab));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <YujiHeader />
      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
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
                  <AppText variant="label" color={active ? 'black' : 'placeholderGray'}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.warmWhite,
  },
  tabs: {
    height: 48,
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
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
