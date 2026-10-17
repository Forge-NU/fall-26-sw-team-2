import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { DayAtAGlance } from '@/components/itinerary/day-at-a-glance';
import { DayMoments } from '@/components/itinerary/day-moments';
import { PostAuthor } from '@/components/post-author';
import { Avatar } from '@/components/ui/avatar';
import { YujiLogo } from '@/components/yuji-header';
import { Palette, Radius, ScreenGutter } from '@/constants/theme';
import { getItinerary } from '@/data/mock';

export default function ItineraryDayScreen() {
  const { id, day } = useLocalSearchParams<{ id: string; day?: string }>();
  const itinerary = getItinerary(id);
  const [selectedDay, setSelectedDay] = useState(() => Number(day) || 1);

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  if (!itinerary) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, styles.missing]}>
        <AppText variant="display" size={24}>
          Itinerary not found
        </AppText>
        <Pressable accessibilityRole="button" onPress={goBack}>
          <AppText variant="bold" size={13} color="coral">
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
          <AppText variant="semibold" size={13}>
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
            <AppText variant="bold" size={12}>
              Share
            </AppText>
          </Pressable>
        </View>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        <View style={styles.context}>
          <View style={styles.identity}>
            <AppText variant="display" size={20}>
              {itinerary.title}
            </AppText>
            <AppText size={12} color="inkMuted">
              {itinerary.days.length} days · {itinerary.stops} stops
            </AppText>
          </View>
          {itinerary.participants.length > 0 && (
            <View style={styles.participants}>
              <AppText variant="semibold" size={11} color="inkMuted">
                Participants
              </AppText>
              <View style={styles.avatars}>
                {itinerary.participants.map((participant, index) => (
                  <Avatar
                    key={participant.id}
                    name={participant.name}
                    url={participant.avatarUrl}
                    size={20}
                    style={[styles.participant, index > 0 && styles.overlap]}
                  />
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
                  <AppText
                    variant={active ? 'bold' : 'medium'}
                    size={12}
                    color={active ? 'surface' : 'inkMuted'}>
                    Day {d.day}
                  </AppText>
                  {active && <View style={styles.dayIndicator} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.daySummary}>
          <AppText variant="display" size={32} leading={1.1}>
            {tripDay.title}
          </AppText>
          <AppText size={13} color="inkMuted">
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
    backgroundColor: Palette.surface,
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
    paddingHorizontal: ScreenGutter,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
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
    borderRadius: Radius.pill,
    backgroundColor: Palette.coralSoft,
  },
  context: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: ScreenGutter,
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
    borderColor: Palette.surface,
  },
  overlap: {
    marginLeft: -8,
  },
  daySwitcher: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: ScreenGutter,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  dayChoice: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Palette.surface,
  },
  dayChoiceActive: {
    backgroundColor: Palette.ink,
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
    paddingHorizontal: ScreenGutter,
  },
});
