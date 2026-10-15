import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Icon, IconName } from '@/components/icon';
import { LocationSheet } from '@/components/story/location-sheet';
import { StoryDateSheet } from '@/components/story/story-date-sheet';
import { TripChooserSheet } from '@/components/story/trip-chooser-sheet';
import { Toggle } from '@/components/ui/toggle';
import { FontFamily, Palette, Radius, ScreenGutter } from '@/constants/theme';
import { ActiveTrips, NearbyPlaces, StoryDraft, type NearbyPlace } from '@/data/mock';
import { formatDay, formatRange, isWithin, tripDayNumber } from '@/utils/dates';

type Sheet = 'trip' | 'date' | 'location' | null;

const comingSoon = (feature: string) => Alert.alert(feature, 'Coming in a later wireframe.');

/** Post-story form. Everything stays local until the posts API is wired up. */
export function StoryComposer({ onDismiss, onPosted }: { onDismiss: () => void; onPosted: () => void }) {
  const suggestedTrip = ActiveTrips.find((trip) => trip.suggested) ?? null;

  const [text, setText] = useState(StoryDraft.text);
  const [editingText, setEditingText] = useState(false);
  const [location, setLocation] = useState<NearbyPlace | null>(NearbyPlaces[0]);
  const [tripId, setTripId] = useState<string | null>(suggestedTrip?.id ?? null);
  const [addToTrip, setAddToTrip] = useState(true);
  const [storyDate, setStoryDate] = useState(StoryDraft.capturedAt.date);
  const [sheet, setSheet] = useState<Sheet>(null);

  const trip = ActiveTrips.find((t) => t.id === tripId) ?? null;
  const linkedTrip = trip && addToTrip ? trip : null;

  const selectTrip = (id: string | null) => {
    setTripId(id);
    setSheet(null);
    const next = ActiveTrips.find((t) => t.id === id);
    // Keep the story date inside the newly linked trip.
    if (next && !isWithin(storyDate, next.startDate, next.endDate)) {
      setStoryDate(isWithin(StoryDraft.capturedAt.date, next.startDate, next.endDate) ? StoryDraft.capturedAt.date : next.startDate);
    }
  };

  const dateTitle = linkedTrip
    ? `${formatDay(storyDate)} · Day ${tripDayNumber(storyDate, linkedTrip.startDate)}`
    : formatDay(storyDate);
  const dateDetail =
    storyDate === StoryDraft.capturedAt.date
      ? `From photo · ${StoryDraft.capturedAt.time} · editable`
      : 'Picked manually · editable';

  return (
    <>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Discard story" onPress={onDismiss} style={styles.dismiss}>
          <Icon name="x" />
          <AppText variant="display" size={22}>
            Post story
          </AppText>
        </Pressable>
        <AppText variant="bold" size={11} color="inkMuted">
          {StoryDraft.audience}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.editor}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.media}>
          <Image source={StoryDraft.media} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(23,26,33,0.13)', 'rgba(23,26,33,0)', 'rgba(23,26,33,0.56)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.mediaControls}>
            <MediaAction icon="camera" label="Camera" onPress={() => comingSoon('Camera')} />
            <MediaAction icon="images" label="Photos" onPress={() => comingSoon('Photos')} />
            <MediaAction icon="type" label="Add text" onPress={() => setEditingText(true)} />
          </View>
          <View style={styles.textOverlay}>
            {editingText ? (
              <TextInput
                value={text}
                onChangeText={setText}
                autoFocus
                onBlur={() => setEditingText(false)}
                placeholder="Add text"
                placeholderTextColor="rgba(255,252,250,0.7)"
                style={styles.textInput}
                returnKeyType="done"
              />
            ) : (
              text.length > 0 && (
                <AppText variant="display" size={22} color="surface">
                  {text}
                </AppText>
              )
            )}
            <Pressable accessibilityRole="button" onPress={() => setEditingText(true)} style={styles.editText}>
              <Icon name="pencil" size={12} color="surface" />
              <AppText variant="semibold" size={10} color="surface">
                Edit text · optional
              </AppText>
            </Pressable>
          </View>
        </View>

        <View style={styles.music}>
          <View style={styles.musicSymbol}>
            <Icon name="music" size={17} color="coral" />
          </View>
          <View style={styles.grow}>
            <AppText variant="bold" size={12} leading={1.35}>
              {StoryDraft.song.title}
            </AppText>
            <AppText size={10} color="inkMuted" leading={1.35}>
              {StoryDraft.song.detail}
            </AppText>
          </View>
          <ChangeButton onPress={() => comingSoon('Music')} />
        </View>

        <Pressable accessibilityRole="button" onPress={() => setSheet('location')} style={styles.location}>
          <Icon name="map-pin" />
          <View style={styles.grow}>
            <AppText variant="bold" size={12} leading={1.35}>
              {location?.name ?? 'Add a location'}
            </AppText>
            <AppText size={10} color="inkMuted" leading={1.35}>
              Location · optional
            </AppText>
          </View>
          <AppText variant="bold" size={11} leading={1.35}>
            {location ? 'Change' : 'Add'}
          </AppText>
        </Pressable>

        <View style={styles.field}>
          <View style={styles.fieldLabel}>
            <AppText variant="bold" size={11} color="inkMuted" leading={1.35}>
              Trip · optional
            </AppText>
            {trip?.suggested && (
              <AppText variant="bold" size={9} color="inkMuted">
                Suggested active trip
              </AppText>
            )}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setSheet('trip')} style={styles.selectedTrip}>
            <Icon name="calendar-days" size={19} />
            <View style={styles.grow}>
              <AppText variant="bold" size={13} leading={1.35}>
                {trip?.title ?? 'No trip'}
              </AppText>
              <AppText size={10} color="inkMuted" leading={1.35}>
                {trip ? `${formatRange(trip.startDate, trip.endDate)} · ${trip.status}` : 'Posting without a trip'}
              </AppText>
            </View>
            <Icon name="chevron-down" />
          </Pressable>
        </View>

        {trip && (
          <View style={styles.addToTrip}>
            <AppText variant="bold" size={12}>
              Add to trip
            </AppText>
            <Toggle value={addToTrip} onValueChange={setAddToTrip} accessibilityLabel="Add to trip" />
          </View>
        )}

        <View style={styles.field}>
          <AppText variant="bold" size={11} color="inkMuted" leading={1.35}>
            Story date · optional
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => setSheet('date')} style={styles.dateDropdown}>
            <Icon name="calendar" size={16} color="coral" />
            <View style={styles.grow}>
              <AppText variant="bold" size={12} leading={1.35}>
                {dateTitle}
              </AppText>
              <AppText size={9} color="inkMuted" leading={1.35}>
                {dateDetail}
              </AppText>
            </View>
            <Icon name="chevron-down" />
          </Pressable>
        </View>

        <ActionButton label="Post story" trailingIcon="arrow-right" onPress={onPosted} />
      </ScrollView>

      <TripChooserSheet
        visible={sheet === 'trip'}
        trips={ActiveTrips}
        selectedId={tripId}
        onSelect={selectTrip}
        onCreateTrip={() => {
          setSheet(null);
          comingSoon('Create trip');
        }}
        onClose={() => setSheet(null)}
      />
      <StoryDateSheet
        visible={sheet === 'date'}
        trip={linkedTrip}
        value={storyDate}
        capturedAt={StoryDraft.capturedAt}
        onConfirm={(date) => {
          setStoryDate(date);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <LocationSheet
        visible={sheet === 'location'}
        value={location}
        onConfirm={(place) => {
          setLocation(place);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

function MediaAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.mediaAction}>
      <Icon name={icon} size={14} />
      <AppText variant="bold" size={10} leading={1.35}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ChangeButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <AppText variant="bold" size={11} leading={1.35}>
        Change
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ScreenGutter,
  },
  dismiss: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editor: {
    gap: 16,
    paddingHorizontal: ScreenGutter,
    paddingVertical: 8,
  },
  media: {
    height: 188,
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Palette.border,
  },
  mediaControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mediaAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
  },
  textOverlay: {
    gap: 4,
  },
  textInput: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Palette.surface,
    padding: 0,
  },
  editText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  music: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  musicSymbol: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.coralSoft,
  },
  location: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  grow: {
    flex: 1,
    gap: 2,
  },
  field: {
    gap: 5,
  },
  fieldLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedTrip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addToTrip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateDropdown: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
});
