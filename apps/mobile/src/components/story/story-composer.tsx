import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon, IconName } from '@/components/icon';
import { LocationPicker } from '@/components/location/location-picker';
import { QuickTripSheet } from '@/components/story/quick-trip-sheet';
import { StoryDateSheet } from '@/components/story/story-date-sheet';
import { TripChooserSheet, tripStatusLabel } from '@/components/trip-chooser-sheet';
import { Input } from '@/components/ui/input';
import { Media } from '@/components/ui/media';
import { Toggle } from '@/components/ui/toggle';
import { StoryTokens } from '@/constants/story-tokens';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useStoryComposer } from '@/hooks/use-story-composer';
import { formatDate, formatDateRange, tripDayNumber } from '@/utils/local-date';

type Sheet = 'trip' | 'new-trip' | 'date' | null;

/** Post-story form. Posting hands the story to the background upload queue. */
export function StoryComposer({ onDismiss, onPosted }: { onDismiss: () => void; onPosted: () => void }) {
  const composer = useStoryComposer();

  const [editingText, setEditingText] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  // iOS can't present a modal while another is still dismissing, so going
  // from the trip chooser to Create trip waits for the chooser to close
  const [sheetAfterClose, setSheetAfterClose] = useState<Sheet>(null);

  const { trip, storyDate } = composer;

  const tripDetail = trip
    ? `${formatDateRange(trip.startDate, trip.endDate)} · ${tripStatusLabel(trip)}`
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
            colors={StoryTokens.mediaScrim.colors}
            locations={StoryTokens.mediaScrim.locations}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.mediaControls}>
            <MediaAction icon="camera" label="Camera" onPress={() => pickPhoto('camera')} />
            <MediaAction icon="images" label="Photos" onPress={() => pickPhoto('library')} />
            <MediaAction icon="type" label="Add text" onPress={() => setEditingText(true)} />
          </View>
          <View style={styles.textOverlay}>
            {editingText ? (
              <Input
                variant="bare"
                accessibilityLabel="Story text"
                value={composer.text}
                onChangeText={composer.setText}
                maxLength={composer.textMax}
                autoFocus
                onBlur={() => setEditingText(false)}
                placeholder="Add text"
                placeholderTextColor={StoryTokens.overlayText.placeholder}
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

        <View style={styles.field}>
          <AppText variant="caption" color="placeholderGray">
            Location · optional
          </AppText>
          {/* The caption above is the label, so the picker's own centered one is off */}
          <LocationPicker
            label=""
            placeholder="Add a location"
            value={composer.location}
            onChange={composer.setLocation}
          />
        </View>

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
                  {`${formatDate(storyDate)} · Day ${tripDayNumber(trip.startDate, storyDate)}`}
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
          loading={composer.photoStatus === 'preparing' || composer.posting}
          onPress={post}
        />
      </ScrollView>

      <TripChooserSheet
        visible={sheet === 'trip'}
        trips={composer.trips}
        selectedId={trip?.id ?? null}
        onSelect={(id) => {
          composer.selectTrip(id);
          setSheet(null);
        }}
        describe={(t) => (t.id === composer.suggestedTripId ? 'Suggested · active today' : 'Active today')}
        onPostWithoutTrip={() => {
          composer.selectTrip(null);
          setSheet(null);
        }}
        onCreateTrip={() => {
          if (Platform.OS === 'ios') {
            setSheetAfterClose('new-trip');
            setSheet(null);
          } else {
            setSheet('new-trip');
          }
        }}
        onClose={() => setSheet(null)}
        onDismiss={() => {
          if (sheetAfterClose) setSheet(sheetAfterClose);
          setSheetAfterClose(null);
        }}
      />
      <QuickTripSheet
        visible={sheet === 'new-trip'}
        today={composer.today}
        onCreate={composer.createQuickTrip}
        onCreated={() => setSheet(null)}
        onClose={() => setSheet(null)}
      />
      <StoryDateSheet
        visible={sheet === 'date'}
        trip={trip}
        value={storyDate}
        onConfirm={(date) => {
          composer.setStoryDate(date);
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

const styles = StyleSheet.create({
  fullWidth: {
    alignSelf: 'stretch',
  },
  nav: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  dismiss: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editor: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  media: {
    height: 188,
    justifyContent: 'space-between',
    padding: Spacing.two + Spacing.one,
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
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radii.small,
    backgroundColor: Palette.warmWhite,
  },
  textOverlay: {
    gap: Spacing.one,
  },
  textInput: {
    fontFamily: StoryTokens.overlayText.fontFamily,
    fontSize: StoryTokens.overlayText.fontSize,
    lineHeight: StoryTokens.overlayText.lineHeight,
    color: Palette.warmWhite,
  },
  editText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  grow: {
    flex: 1,
    gap: Spacing.half,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectedTrip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Palette.lightPink,
  },
});
