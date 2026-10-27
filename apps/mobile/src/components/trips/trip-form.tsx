import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Input } from '@/components/ui/input';
import { Palette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import {
  charCount,
  hasErrors,
  TRIP_LIMITS,
  validateTripForm,
  type TripFormErrors,
  type TripFormValues,
} from '@/lib/trip-form';
import { tripDayCount } from '@/utils/trip-dates';

export type TripFormProps = {
  initialValues: TripFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: TripFormValues) => void;
  // visitedOn of existing posts, so date changes can't strand them
  postDates?: string[];
  // Server error that isn't tied to one field
  formError?: string | null;
  footer?: ReactNode;
};

// Create and edit trip form (wireframe 01). Fields follow DOC-1, so the
// wireframe's visibility picker and cover upload aren't here.
export function TripForm({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
  postDates,
  formError,
  footer,
}: TripFormProps) {
  const [values, setValues] = useState(initialValues);
  // Errors show after the first save attempt, then update as the user types
  const [submitted, setSubmitted] = useState(false);
  const errors: TripFormErrors = submitted ? validateTripForm(values, postDates) : {};

  const set = <K extends keyof TripFormValues>(key: K, value: TripFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    setSubmitted(true);
    if (!hasErrors(validateTripForm(values, postDates))) onSubmit(values);
  };

  const dayCount =
    values.startDate && values.endDate && values.endDate >= values.startDate
      ? tripDayCount(values.startDate, values.endDate)
      : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.fields}
        keyboardShouldPersistTaps="handled">
        <Input
          label="Trip name"
          placeholder="e.g. Lisbon weekend"
          value={values.title}
          onChangeText={(text) => set('title', text)}
          error={errors.title}
          maxLength={TRIP_LIMITS.title * 2}
          returnKeyType="next"
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
        {dayCount ? (
          <AppText variant="caption" style={styles.muted}>
            {dayCount === 1 ? 'Creates Day 1' : `Creates Day 1 – Day ${dayCount}`}
          </AppText>
        ) : null}

        <Input
          label="Destination"
          placeholder="e.g. Lisbon, Portugal"
          value={values.destination}
          onChangeText={(text) => set('destination', text)}
          error={errors.destination}
          maxLength={TRIP_LIMITS.destination * 2}
        />

        <Input
          label="Description (optional)"
          placeholder="What's this trip about?"
          value={values.description}
          onChangeText={(text) => set('description', text)}
          error={errors.description}
          hint={
            charCount(values.description) > TRIP_LIMITS.description * 0.8
              ? `${charCount(values.description)} / ${TRIP_LIMITS.description}`
              : undefined
          }
          multiline
          style={styles.description}
        />

        {formError ? (
          <AppText variant="label" accessibilityLiveRegion="polite" style={styles.formError}>
            {formError}
          </AppText>
        ) : null}

        {footer}
      </ScrollView>

      <Button title={submitLabel} loading={submitting} onPress={submit} style={styles.submit} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fields: { gap: Spacing.three, paddingBottom: Spacing.four },
  dates: { flexDirection: 'row', gap: Spacing.two },
  muted: { textAlign: 'center', color: Palette.placeholderGray, marginTop: -Spacing.two },
  description: { minHeight: 88, textAlignVertical: 'top' },
  formError: { color: Palette.coral, textAlign: 'center' },
  submit: { width: '100%', marginTop: Spacing.two },
});
