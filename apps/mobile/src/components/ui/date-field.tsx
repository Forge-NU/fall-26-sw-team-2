import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { InputTokens } from '@/constants/input-tokens';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';
import { toIsoDate, todayLocalIso } from '@/utils/local-date';
import { formatDate, monthName } from '@/utils/trip-dates';

export type DateFieldProps = {
  label: string;
  value: string | null; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
};

// Looks like Input, opens a month calendar. Plain JS so it works the same on
// iOS, Android and web without a native date picker module.
export function DateField({ label, value, onChange, placeholder = 'Pick a date', error }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'not set'}`}
        onPress={() => setOpen(true)}
        style={[styles.field, error ? styles.fieldError : null]}>
        <AppText style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDate(value) : placeholder}
        </AppText>
        <Ionicons name="calendar-outline" size={16} color={Palette.placeholderGray} />
      </Pressable>
      {error ? (
        <AppText variant="label" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      {open ? (
        <CalendarModal
          title={label}
          value={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

type CalendarModalProps = {
  title: string;
  value: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
};

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CalendarModal({ title, value, onSelect, onClose }: CalendarModalProps) {
  const initial = value ?? todayLocalIso();
  const [cursor, setCursor] = useState(() => {
    const [year, month] = initial.split('-').map(Number);
    return { year, month };
  });

  const first = new Date(cursor.year, cursor.month - 1, 1);
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIsoDate(new Date(cursor.year, cursor.month - 1, i + 1))),
  ];
  const today = todayLocalIso();

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month - 1 + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() + 1 });
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <AppText variant="label" style={styles.sheetTitle}>
            {title}
          </AppText>
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => shiftMonth(-1)}>
              <Ionicons name="chevron-back" size={20} color={Palette.black} />
            </Pressable>
            <AppText variant="subheading">
              {monthName(cursor.month)} {cursor.year}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => shiftMonth(1)}>
              <Ionicons name="chevron-forward" size={20} color={Palette.black} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {WEEKDAY_INITIALS.map((day, i) => (
              <AppText key={`h${i}`} variant="caption" style={[styles.cell, styles.weekday]}>
                {day}
              </AppText>
            ))}
            {cells.map((date, i) =>
              date ? (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={formatDate(date)}
                  accessibilityState={{ selected: date === value }}
                  onPress={() => onSelect(date)}
                  style={[styles.cell, date === value && styles.selected]}>
                  <AppText
                    variant="label"
                    style={[
                      styles.dayText,
                      date === today && styles.today,
                      date === value && styles.selectedText,
                    ]}>
                    {Number(date.slice(8))}
                  </AppText>
                </Pressable>
              ) : (
                <View key={`e${i}`} style={styles.cell} />
              ),
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELL = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  container: { flex: 1, gap: InputTokens.gap },
  label: { textAlign: 'center' },
  field: {
    minHeight: InputTokens.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: InputTokens.borderWidth,
    borderColor: InputTokens.border,
    borderRadius: InputTokens.borderRadius,
    paddingHorizontal: InputTokens.paddingHorizontal,
    backgroundColor: InputTokens.background,
  },
  fieldError: { borderColor: InputTokens.errorBorder, borderWidth: InputTokens.focusedBorderWidth },
  value: { flex: 1 },
  placeholder: { color: InputTokens.placeholder },
  error: { color: InputTokens.errorBorder },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium * 2,
    backgroundColor: Palette.warmWhite,
  },
  sheetTitle: { textAlign: 'center', color: Palette.placeholderGray },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radii.circle },
  weekday: { textAlign: 'center', textAlignVertical: 'center', color: Palette.placeholderGray },
  dayText: { color: Palette.black },
  today: { color: Palette.coral },
  selected: { backgroundColor: Palette.coral },
  selectedText: { color: Palette.white },
});
