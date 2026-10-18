import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/icon';
import { DayAtAGlance } from '@/components/itinerary/day-at-a-glance';
import { DayMoments } from '@/components/itinerary/day-moments';
import { PostAuthor } from '@/components/post-author';
import { Avatar } from '@/components/ui/avatar';
import { YujiLogo } from '@/components/yuji-header';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { getItinerary } from '@/data/mock';

export default function ItineraryDayScreen() {
  const { id, day } = useLocalSearchParams<{ id: string; day?: string }>();
  const itinerary = getItinerary(id);
  const [selectedDay, setSelectedDay] = useState(() => Number(day) || 1);

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  if (!itinerary) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, styles.missing]}>
        <AppText variant="heading">
          Itinerary not found
        </AppText>
        <Pressable accessibilityRole="button" onPress={goBack}>
          <AppText variant="label" color="coral">
            Back to feed
          </AppText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const tripDay = itinerary.days.find((d) => d.day === selectedDay) ?? itinerary.days[0];

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.navSide}>
          <Icon name="chevron-left" size={20} />
          <AppText variant="label">
            Itinerary
          </AppText>
        </Pressable>
        <YujiLogo size={36} />
        <View style={[styles.navSide, styles.navEnd]}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Share.share({
                message: `${itinerary.title} · Day ${tripDay.day}`,
              })
            }
            style={styles.shareButton}>
            <Icon name="share-2" size={22} color="coral" />
            <AppText variant="caption">
              Share
            </AppText>
          </Pressable>
        </View>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        <View style={styles.context}>
          <View style={styles.identity}>
            <AppText variant="heading">
              {itinerary.title}
            </AppText>
            <AppText variant="caption" color="placeholderGray">
              {itinerary.days.length} days · {itinerary.stops} stops
            </AppText>
          </View>
          {itinerary.participants.length > 0 && (
            <View style={styles.participants}>
              <AppText variant="caption" color="placeholderGray">
                Participants
              </AppText>
              <View style={styles.avatars}>
                {itinerary.participants.map((participant, index) => (
                  // Avatar has no style prop, so the overlap ring lives on a wrapper.
                  <View
                    key={participant.id}
                    style={[styles.participant, index > 0 && styles.overlap]}>
                    <Avatar name={participant.name} uri={participant.avatarUrl} size="compact" />
                  </View>
                ))}
              </View>
            </View>
          )}
          <PostAuthor
            author={itinerary.author}
            meta={`${itinerary.location} · ${itinerary.postedAgo}`}
          />
        </View>

        {/* Sticky headers get their style replaced on native, so the row lives one level down. */}
        <View>
          <View style={styles.daySwitcher} accessibilityRole="tablist">
            {itinerary.days.map((d) => {
              const active = d.day === tripDay.day;
              return (
                <Pressable
                  key={d.day}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDay(d.day)}
                  style={[styles.dayChoice, active && styles.dayChoiceActive]}>
                  <AppText variant="caption" color={active ? 'warmWhite' : 'placeholderGray'}>
                    Day {d.day}
                  </AppText>
                  {active && <View style={styles.dayIndicator} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.daySummary}>
          <AppText variant="heading">
            {tripDay.title}
          </AppText>
          <AppText variant="body" color="placeholderGray">
            {tripDay.summary}
          </AppText>
        </View>

        <DayMoments day={tripDay} />
        <DayAtAGlance key={`${itinerary.id}-${tripDay.day}`} places={tripDay.places} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.warmWhite,
  },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  nav: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Palette.lightPink,
  },
  navSide: {
    width: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navEnd: {
    justifyContent: 'flex-end',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.circle,
    backgroundColor: Palette.peach,
  },
  context: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: Spacing.three,
  },
  identity: {
    gap: 5,
  },
  participants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatars: {
    flexDirection: 'row',
  },
  participant: {
    borderWidth: 1,
    borderColor: Palette.warmWhite,
    borderRadius: Radii.circle,
  },
  overlap: {
    marginLeft: -8,
  },
  daySwitcher: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: Spacing.three,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
  dayChoice: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.small,
    overflow: 'hidden',
    backgroundColor: Palette.warmWhite,
  },
  dayChoiceActive: {
    backgroundColor: Palette.black,
  },
  dayIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: Palette.coral,
  },
  daySummary: {
    gap: 7,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: Spacing.three,
  },
});
