import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chip, GlassChip, MenuButton } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { LoadError } from '@/components/ui/load-error';
import { Material } from '@/components/ui/material';
import { PlaceSave } from '@/components/ui/place-save';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StarRating } from '@/components/ui/star-rating';
import { TabBar } from '@/components/ui/tab-bar';
import { Toggle } from '@/components/ui/toggle';
import { useToast } from '@/components/ui/toast-provider';
import { RatingTokens, type RatingSize } from '@/constants/rating-tokens';
import { Radii, Spacing, Theme } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { ratingValueText } from '@/lib/rating';

const SCREEN_STATES = ['content', 'loading', 'empty', 'error'] as const;
const TEXT_STYLES = ['display', 'title', 'headline', 'body', 'button', 'subhead', 'footnote', 'label', 'caption'] as const;
const BUTTON_TYPES = ['primary', 'secondary', 'tertiary', 'tinted'] as const;
type ScreenState = (typeof SCREEN_STATES)[number];

// Components preview: Screen, ScreenHeader, Pill, DateField, Toggle, TabBar
// and StarRating, plus the redesign kit: the text styles, Button types and
// sizes, toasts, LoadError and the system alert from confirmAction.
export function PrimitivesPreview() {
  const { showToast } = useToast();
  const [screenState, setScreenState] = useState<ScreenState>('content');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>('2026-10-06');
  const [toggle, setToggle] = useState(true);
  const [tab, setTab] = useState<'trips' | 'posts' | 'places'>('trips');
  const [rating, setRating] = useState<number | null>(3);
  const [category, setCategory] = useState<string | null>('Food');
  const [side, setSide] = useState<'posts' | 'bucket'>('posts');
  const [scope, setScope] = useState<'all' | 'people' | 'places' | 'trips' | 'posts'>('all');
  const [saved, setSaved] = useState(false);

  return (
    <View style={styles.section}>
      <AppText variant="title">Text styles</AppText>
      <View style={styles.full}>
        {TEXT_STYLES.map((variant) => (
          <AppText key={variant} variant={variant}>
            {variant}
          </AppText>
        ))}
        <AppText variant="subhead" color="textSecondary">
          textSecondary
        </AppText>
        <AppText variant="subhead" color="textAccent">
          textAccent
        </AppText>
      </View>

      <AppText variant="title">Buttons</AppText>
      {BUTTON_TYPES.map((type) => (
        <View key={type} style={styles.row}>
          <Button title={type} variant={type} onPress={() => undefined} />
          <Button title="Small" variant={type} size="small" onPress={() => undefined} />
          <Button title="Off" variant={type} size="small" disabled onPress={() => undefined} />
        </View>
      ))}
      <Button title="Loading" variant="primary" loading onPress={() => undefined} />

      <AppText variant="title">Toasts</AppText>
      <View style={styles.row}>
        <Button title="Success" variant="secondary" size="small" onPress={() => showToast({ message: 'Trip deleted', variant: 'success' })} />
        <Button title="Error" variant="secondary" size="small" onPress={() => showToast({ message: "Couldn't save. Try again.", variant: 'error' })} />
        <Button
          title="Undo, bottom"
          variant="secondary"
          size="small"
          onPress={() =>
            showToast({
              message: 'Removed Kiyomizu-dera',
              placement: 'bottom',
              action: { label: 'Undo', onPress: () => showToast({ message: 'Back in your places', variant: 'success' }) },
            })
          }
        />
      </View>

      <AppText variant="title">Load error</AppText>
      <LoadError what="this trip" onRetry={() => showToast({ message: 'Trying again' })} />

      <AppText variant="title">Chips</AppText>
      <View style={styles.row}>
        {['Food', 'Hotels', 'Sightseeing'].map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
        ))}
        <Chip label="Belém" leadingIcon="map-pin" />
      </View>
      <Material style={styles.glassRow}>
        <GlassChip label="Friends" menu onPress={() => undefined} />
        <GlassChip label="Near me" nearIcon onPress={() => undefined} />
        <GlassChip label="Food" selected onPress={() => undefined} />
      </Material>
      <View style={styles.row}>
        <MenuButton label="Most relevant" onPress={() => undefined} />
        <MenuButton label="Dec 4 – 6" on onPress={() => undefined} />
      </View>

      <AppText variant="title">Segmented control</AppText>
      <View style={styles.full}>
        <SegmentedControl
          segments={[
            { key: 'posts', label: 'Posts' },
            { key: 'bucket', label: 'Bucket', leadingIcon: 'lock' },
          ]}
          value={side}
          onChange={setSide}
        />
      </View>
      <View style={styles.full}>
        <SegmentedControl
          segments={[
            { key: 'all', label: 'All' },
            { key: 'people', label: 'People' },
            { key: 'places', label: 'Places' },
            { key: 'trips', label: 'Trips' },
            { key: 'posts', label: 'Posts' },
          ]}
          value={scope}
          onChange={setScope}
        />
      </View>

      <AppText variant="title">Place save</AppText>
      <View style={styles.row}>
        <AppText variant="headline">Time Out Market</AppText>
        <PlaceSave saved={saved} placeName="Time Out Market" onPress={() => setSaved(!saved)} />
      </View>

      <AppText variant="title">Nav headers</AppText>
      <View style={styles.full}>
        <ScreenHeader largeTitle title="Your trips" right={<IconButton icon="plus" accessibilityLabel="New trip" />} />
        <ScreenHeader title="Lisbon with the crew" left={{ icon: 'chevron-left', label: 'Back', onPress: () => undefined }} />
        <ScreenHeader
          title="Lisbon with the crew"
          left={{ icon: 'chevron-left', label: 'Back', onPress: () => undefined }}
          right={<IconButton icon="share" accessibilityLabel="Share" />}
        />
        <ScreenHeader hideTitle title="Lisbon" left={{ icon: 'chevron-left', label: 'Back', onPress: () => undefined }} />
      </View>

      <AppText variant="supporting">Screen + ScreenHeader</AppText>
      <View style={styles.row}>
        {SCREEN_STATES.map((state) => (
          <Pill
            key={state}
            label={state}
            state={screenState === state ? 'selected' : 'default'}
            onPress={() => setScreenState(state)}
          />
        ))}
      </View>
      <View style={styles.frame}>
        <Screen
          edges={[]}
          header={
            <ScreenHeader
              title="Lisbon weekend"
              left={{ icon: 'arrow-left', label: 'Back', onPress: () => setScreenState('content') }}
              right={<IconButton icon="pencil" accessibilityLabel="Edit" />}
            />
          }
          scroll
          loading={screenState === 'loading'}
          error={screenState === 'error' ? new TypeError('Network request failed') : null}
          onRetry={() => setScreenState('content')}
          empty={
            screenState === 'empty' && {
              icon: 'airplane-outline',
              title: 'No trips yet',
              description: 'Make a trip, then add posts to it as you go.',
              action: { title: 'New trip', onPress: () => setScreenState('content') },
            }
          }>
          <AppText>Screen content scrolls under a fixed header.</AppText>
          <AppText variant="caption" color="placeholderGray">
            Loading wins over error, and error over empty.
          </AppText>
        </Screen>
      </View>

      <AppText variant="supporting">Tab bar</AppText>
      <View style={styles.full}>
        <TabBar
          items={[
            { key: 'trips', label: 'Trips' },
            { key: 'posts', label: 'Posts' },
            { key: 'places', label: 'Places' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <AppText variant="supporting">Pills</AppText>
      <View style={styles.row}>
        <Pill label="Default" />
        <Pill label="Selected" state="selected" />
        <Pill label="Day 3 of 4" state="selected" />
        <Pill label="Belém" showPin />
      </View>

      <AppText variant="supporting">Date fields</AppText>
      <View style={styles.row}>
        <DateField label="Start date" value={start} onChange={setStart} />
        <DateField
          label="End date"
          value={end}
          onChange={setEnd}
          error={start && end && end < start ? 'End is before start' : undefined}
        />
      </View>

      <AppText variant="supporting">Toggle</AppText>
      <View style={styles.row}>
        <Toggle value={toggle} onValueChange={setToggle} accessibilityLabel="Preview toggle" />
        <AppText variant="label">{toggle ? 'On' : 'Off'}</AppText>
      </View>

      <AppText variant="supporting">Star rating</AppText>
      <View style={styles.ratings}>
        <StarRating value={5} />
        <StarRating value={4.3} count={12} showLabel />
        <StarRating value={3.5} showLabel />
        <StarRating value={null} />
        {(Object.keys(RatingTokens.sizes) as RatingSize[]).map((size) => (
          <View key={size} style={styles.ratingSize}>
            <AppText variant="label">{size}</AppText>
            <StarRating value={4.3} count={12} showLabel size={size} />
          </View>
        ))}
      </View>
      <StarRating value={rating} onChange={setRating} accessibilityLabel="Preview rating" />
      <AppText variant="caption" color="placeholderGray">
        {ratingValueText(rating)} · tap the same star to clear
      </AppText>

      <AppText variant="supporting">Alert</AppText>
      <Button
        title="Delete trip"
        variant="secondary"
        onPress={() =>
          confirmAction({
            title: 'Delete this trip?',
            message: "Its 3 posts will be deleted too. You can't undo this.",
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: () => showToast({ message: 'Trip deleted', variant: 'success' }),
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', maxWidth: 361, gap: Spacing.three, alignItems: 'center' },
  full: { width: '100%' },
  glassRow: { width: '100%', flexDirection: 'row', gap: Spacing.two, padding: Spacing.two, borderRadius: Radii.md },
  ratings: { gap: Spacing.two, alignItems: 'flex-start' },
  ratingSize: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  row: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: Spacing.two },
  frame: {
    width: '100%',
    height: 320,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Radii.medium,
    overflow: 'hidden',
  },
});
