import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { TripResponse } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon, IconName } from '@/components/icon';
import { LocationSheet } from '@/components/story/location-sheet';
import { StoryDateSheet } from '@/components/story/story-date-sheet';
import { TripChooserSheet } from '@/components/trip-chooser-sheet';
import { Media } from '@/components/ui/media';
import { Toggle } from '@/components/ui/toggle';
import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { StoryDraft, type ActiveTrip, type NearbyPlace } from '@/data/mock';
import { useStoryComposer } from '@/hooks/use-story-composer';
import { formatDay, formatRange, tripDayNumber } from '@/utils/dates';

type Sheet = 'trip' | 'date' | 'location' | null;

const comingSoon = (feature: string) => Alert.alert(feature, 'Coming in a later wireframe.');

// The trip chooser is shared with "Add places to itinerary" and takes its own trip shape
function toChooserTrip(trip: TripResponse, suggestedTripId: string | null): ActiveTrip {
  return {
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status === 'published' ? 'Published' : 'Unpublished',
    suggested: trip.id === suggestedTripId,
  };
}

/** Post-story form. Posting hands the story to the background upload queue. */
export function StoryComposer({ onDismiss, onPosted }: { onDismiss: () => void; onPosted: () => void }) {
  const composer = useStoryComposer();

  const [editingText, setEditingText] = useState(false);
  // TODO: replace with POST-2's LocationPicker (#65), which takes composer.location directly
  const [placeholderPlace, setPlaceholderPlace] = useState<NearbyPlace | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const { trip, storyDate } = composer;
  const chooserTrips = composer.trips.map((t) => toChooserTrip(t, composer.suggestedTripId));
  const chooserTrip = trip ? toChooserTrip(trip, composer.suggestedTripId) : null;

  const locationLabel =
    composer.location?.kind === 'mapbox'
      ? composer.location.location.name
      : composer.location?.kind === 'custom'
        ? composer.location.name
        : null;

  const tripDetail = trip
    ? `${formatRange(trip.startDate, trip.endDate)} · ${chooserTrip?.status}`
    : composer.tripsLoading
      ? 'Loading your trips…'
      : composer.tripsError
        ? "Couldn't load your trips"
        : 'Posting without a trip';

  async function pickPhoto(source: 'camera' | 'library') {
    const result = await composer.pickPhoto(source);
    if (result === 'denied') {
      Alert.alert(
        source === 'camera' ? 'Camera access is off' : 'Photo access is off',
        'Turn it on for Yuji in Settings to add a photo.',
      );
    } else if (result === 'failed') {
      Alert.alert("Couldn't use that photo", 'Try another one.');
    }
  }

  function post() {
    if (composer.post()) onPosted();
  }

  return (
    <>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Discard story" onPress={onDismiss} style={styles.dismiss}>
          <Icon name="x" />
          <AppText variant="heading">
            Post story
          </AppText>
        </Pressable>
        <AppText variant="caption" color="placeholderGray">
          {StoryDraft.audience}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.editor}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.media}>
          <Media
            seed="story-draft"
            url={composer.photo?.uri}
            iconSize={36}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(23,26,33,0.13)', 'rgba(23,26,33,0)', 'rgba(23,26,33,0.56)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.mediaControls}>
            <MediaAction icon="camera" label="Camera" onPress={() => pickPhoto('camera')} />
            <MediaAction icon="images" label="Photos" onPress={() => pickPhoto('library')} />
            <MediaAction icon="type" label="Add text" onPress={() => setEditingText(true)} />
          </View>
          <View style={styles.textOverlay}>
            {editingText ? (
              <TextInput
                value={composer.text}
                onChangeText={composer.setText}
                maxLength={composer.textMax}
                autoFocus
                onBlur={() => setEditingText(false)}
                placeholder="Add text"
                placeholderTextColor="rgba(255,252,250,0.7)"
                style={styles.textInput}
                returnKeyType="done"
              />
            ) : (
              composer.text.length > 0 && (
                <AppText variant="heading" color="warmWhite">
                  {composer.text}
                </AppText>
              )
            )}
            <Pressable accessibilityRole="button" onPress={() => setEditingText(true)} style={styles.editText}>
              <Icon name="pencil" size={12} color="warmWhite" />
              <AppText variant="caption" color="warmWhite">
                {composer.photoStatus === 'preparing' ? 'Preparing photo…' : 'Edit text · optional'}
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* Music is planned for later; the row matches the wireframe for now */}
        <View style={styles.music}>
          <View style={styles.musicSymbol}>
            <Icon name="music" size={17} color="coral" />
          </View>
          <View style={styles.grow}>
            <AppText variant="caption">
              {StoryDraft.song.title}
            </AppText>
            <AppText variant="caption" color="placeholderGray">
              {StoryDraft.song.detail}
            </AppText>
          </View>
          <ChangeButton onPress={() => comingSoon('Music')} />
        </View>

        <Pressable accessibilityRole="button" onPress={() => setSheet('location')} style={styles.location}>
          <Icon name="map-pin" />
          <View style={styles.grow}>
            <AppText variant="caption">
              {locationLabel ?? 'Add a location'}
            </AppText>
            <AppText variant="caption" color="placeholderGray">
              Location · optional
            </AppText>
          </View>
          <AppText variant="caption">
            {locationLabel ? 'Change' : 'Add'}
          </AppText>
        </Pressable>

        <View style={styles.field}>
          <View style={styles.fieldLabel}>
            <AppText variant="caption" color="placeholderGray">
              Trip · optional
            </AppText>
            {composer.isSuggestedTrip && (
              <AppText variant="caption" color="placeholderGray">
                Suggested active trip
              </AppText>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => (composer.tripsError ? composer.reloadTrips() : setSheet('trip'))}
            style={styles.selectedTrip}>
            <Icon name="calendar-days" size={19} />
            <View style={styles.grow}>
              <AppText variant="label">
                {trip?.title ?? 'No trip'}
              </AppText>
              <AppText variant="caption" color="placeholderGray">
                {composer.tripsError && !trip ? `${tripDetail} · tap to retry` : tripDetail}
              </AppText>
            </View>
            <Icon name="chevron-down" />
          </Pressable>
        </View>

        {trip && (
          <View style={styles.addToTrip}>
            <AppText variant="caption">
              Add to trip
            </AppText>
            <Toggle value={composer.keepOnTrip} onValueChange={composer.setKeepOnTrip} accessibilityLabel="Add to trip" />
          </View>
        )}

        {trip && (
          <View style={styles.field}>
            <AppText variant="caption" color="placeholderGray">
              Story date · optional
            </AppText>
            <Pressable accessibilityRole="button" onPress={() => setSheet('date')} style={styles.dateDropdown}>
              <Icon name="calendar" size={16} color="coral" />
              <View style={styles.grow}>
                <AppText variant="caption">
                  {`${formatDay(storyDate)} · Day ${tripDayNumber(storyDate, trip.startDate)}`}
                </AppText>
                <AppText variant="caption" color="placeholderGray">
                  {storyDate === composer.today ? 'Today · editable' : 'Picked manually · editable'}
                </AppText>
              </View>
              <Icon name="chevron-down" />
            </Pressable>
          </View>
        )}

        {!composer.photo && (
          <AppText variant="caption" color="placeholderGray">
            Add a photo to post your story
          </AppText>
        )}
        <Button
          title="Post story"
          style={styles.fullWidth}
          disabled={!composer.canPost}
          loading={composer.photoStatus === 'preparing'}
          onPress={post}
        />
      </ScrollView>

      <TripChooserSheet
        visible={sheet === 'trip'}
        trips={chooserTrips}
        selectedId={trip?.id ?? null}
        onSelect={(id) => {
          composer.selectTrip(id);
          setSheet(null);
        }}
        describe={(t) => (t.suggested ? 'Suggested · active today' : 'Active today')}
        onPostWithoutTrip={() => {
          composer.selectTrip(null);
          setSheet(null);
        }}
        onCreateTrip={() => {
          setSheet(null);
          // TODO: quick-create trip sheet, built on TRIP-2's DateField + validateTripForm (#64)
          comingSoon('Create trip');
        }}
        onClose={() => setSheet(null)}
      />
      <StoryDateSheet
        visible={sheet === 'date'}
        trip={chooserTrip}
        value={storyDate}
        onConfirm={(date) => {
          composer.setStoryDate(date);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <LocationSheet
        visible={sheet === 'location'}
        value={placeholderPlace}
        onConfirm={(place) => {
          setPlaceholderPlace(place);
          composer.setLocation(place ? { kind: 'custom', name: place.name } : null);
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
      <AppText variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function ChangeButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <AppText variant="caption">
        Change
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    alignSelf: 'stretch',
  },
  nav: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  dismiss: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editor: {
    gap: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  media: {
    height: 188,
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: Radii.small,
    overflow: 'hidden',
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
    borderRadius: Radii.small,
    backgroundColor: Palette.warmWhite,
  },
  textOverlay: {
    gap: 4,
  },
  textInput: {
    fontFamily: Typography.heading.fontFamily,
    fontSize: 22,
    color: Palette.warmWhite,
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
    borderRadius: Radii.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.peach,
  },
  location: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Palette.lightPink,
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
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Palette.lightPink,
  },
});
