import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Input } from '@/components/ui/input';
import { Spacing } from '@/constants/theme';
import type { QuickTripResult } from '@/hooks/use-story-composer';
import { hasErrors, TRIP_LIMITS, type TripFormValues } from '@/lib/trip-form';
import { validateQuickTrip } from '@/lib/trips';

type QuickTripSheetProps = {
  visible: boolean;
  today: string;
  onCreate: (values: TripFormValues) => Promise<QuickTripResult>;
  // Called once the trip is created and selected
  onCreated: () => void;
  onClose: () => void;
};

export function QuickTripSheet(props: QuickTripSheetProps) {
  // Remount each time it opens so the form starts empty.
  return props.visible ? <QuickTripSheetContent {...props} /> : null;
}

// Create a trip without leaving the story composer. Same fields and rules as
// TRIP-2's form (#86), minus the description, and the dates must include today.
function QuickTripSheetContent({ today, onCreate, onCreated, onClose }: QuickTripSheetProps) {
  const [values, setValues] = useState<TripFormValues>({
    title: '',
    destination: '',
    description: '',
    startDate: today,
    endDate: today,
  });
  // Errors show after the first save attempt, then update as the user types
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const errors = submitted ? validateQuickTrip(values, today) : {};

  const set = <K extends keyof TripFormValues>(key: K, value: TripFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function save() {
    setSubmitted(true);
    if (saving || hasErrors(validateQuickTrip(values, today))) return;
    setSaving(true);
    setFormError(null);
    const result = await onCreate(values);
    if ('trip' in result) {
      onCreated();
    } else {
      setFormError(result.error);
      setSaving(false);
    }
  }

  // Closing mid-save would still create the trip and attach it, so wait
  const close = () => {
    if (!saving) onClose();
  };

  return (
    <BottomSheet visible onClose={close} title="Create trip" subtitle="Your story will be added to it">
      <Input
        label="Trip name"
        placeholder="e.g. Lisbon weekend"
        value={values.title}
        onChangeText={(text) => set('title', text)}
        error={errors.title}
        maxLength={TRIP_LIMITS.title * 2}
        returnKeyType="next"
      />
      <Input
        label="Destination"
        placeholder="e.g. Lisbon, Portugal"
        value={values.destination}
        onChangeText={(text) => set('destination', text)}
        error={errors.destination}
        maxLength={TRIP_LIMITS.destination * 2}
      />
      <View style={styles.dates}>
        <DateField
          label="Start date"
          value={values.startDate}
          onChange={(date) => set('startDate', date)}
          error={errors.startDate}
        />
        <DateField
          label="End date"
          value={values.endDate}
          onChange={(date) => set('endDate', date)}
          error={errors.endDate}
        />
      </View>
      {formError ? (
        <AppText variant="label" color="coral" accessibilityLiveRegion="polite" style={styles.formError}>
          {formError}
        </AppText>
      ) : null}
      <Button title="Create trip" loading={saving} onPress={() => void save()} style={styles.fullWidth} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  dates: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  formError: {
    textAlign: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
