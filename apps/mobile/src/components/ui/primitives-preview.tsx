import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DateField } from '@/components/ui/date-field';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TabBar } from '@/components/ui/tab-bar';
import { Toggle } from '@/components/ui/toggle';
import { useToast } from '@/components/ui/toast-provider';
import { Radii, Spacing, Theme } from '@/constants/theme';

const SCREEN_STATES = ['content', 'loading', 'empty', 'error'] as const;
type ScreenState = (typeof SCREEN_STATES)[number];

// UI-3 additions to the components preview: Screen, ScreenHeader, Pill,
// ConfirmDialog, DateField and Toggle. UI-4 added TabBar.
export function PrimitivesPreview() {
  const { showToast } = useToast();
  const [screenState, setScreenState] = useState<ScreenState>('content');
  const [confirming, setConfirming] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>('2026-10-06');
  const [toggle, setToggle] = useState(true);
  const [tab, setTab] = useState<'trips' | 'posts' | 'places'>('trips');

  return (
    <View style={styles.section}>
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
        <Pill label="Day 3 of 4" state="live" />
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

      <AppText variant="supporting">Confirm dialog</AppText>
      <Button title="Delete trip" onPress={() => setConfirming(true)} />
      <ConfirmDialog
        visible={confirming}
        title="Delete this trip?"
        message={'"Lisbon weekend" and its 3 posts will be deleted for good. You can\'t undo this.'}
        confirmLabel="Delete trip"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          showToast({ message: 'Trip deleted', variant: 'success' });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', maxWidth: 361, gap: Spacing.three, alignItems: 'center' },
  full: { width: '100%' },
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
