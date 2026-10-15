import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { Palette, Radius } from '@/constants/theme';
import type { ActiveTrip } from '@/data/mock';
import {
  formatDay,
  formatMonth,
  formatRange,
  isWithin,
  monthGrid,
  parseIsoDate,
} from '@/utils/dates';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type StoryDateSheetProps = {
  visible: boolean;
  /** When set, only the trip's dates can be picked. */
  trip: ActiveTrip | null;
  value: string;
  capturedAt: { date: string; time: string };
  onConfirm: (date: string) => void;
  onClose: () => void;
};

export function StoryDateSheet(props: StoryDateSheetProps) {
  // Remount each time it opens so the pending pick starts from the current value.
  return props.visible ? <StoryDateSheetContent {...props} /> : null;
}

function StoryDateSheetContent({ trip, value, capturedAt, onConfirm, onClose }: StoryDateSheetProps) {
  const [pending, setPending] = useState(value);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parseIsoDate(value);
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  const isSelectable = (iso: string) => !trip || isWithin(iso, trip.startDate, trip.endDate);

  const shiftMonth = (delta: number) =>
    setVisibleMonth(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title="Choose story date"
      titleSize={26}
      closeSize={28}
      gap={8}>
      {trip && (
        <AppText variant="medium" size={10} color="inkMuted" leading={1.35}>
          {trip.title} · {formatRange(trip.startDate, trip.endDate)}
        </AppText>
      )}

      <View style={styles.suggestion}>
        <Icon name="sparkle" size={14} color="coral" />
        <View style={styles.suggestionText}>
          <AppText variant="bold" size={10} leading={1.35}>
            From photo · {formatDay(capturedAt.date)}, {capturedAt.time}
          </AppText>
          <AppText variant="medium" size={10} color="inkMuted" leading={1.35}>
            Suggested date. Pick another date to change it.
          </AppText>
        </View>
      </View>

      <View style={styles.monthNav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} onPress={() => shiftMonth(-1)}>
          <Icon name="chevron-left" color="disabled" />
        </Pressable>
        <AppText variant="display" size={22}>
          {formatMonth(visibleMonth.year, visibleMonth.month)}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} onPress={() => shiftMonth(1)}>
          <Icon name="chevron-right" color="disabled" />
        </Pressable>
      </View>

      <View style={styles.calendar}>
        <View style={styles.weekdays}>
          {WEEKDAYS.map((weekday, index) => (
            <AppText key={index} variant="bold" size={10} color="inkMuted" style={styles.weekday}>
              {weekday}
            </AppText>
          ))}
        </View>
        {monthGrid(visibleMonth.year, visibleMonth.month).map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((iso, dayIndex) => {
              if (!iso) return <View key={dayIndex} style={styles.cell} />;
              const selectable = isSelectable(iso);
              const selected = iso === pending;
              return (
                <Pressable
                  key={iso}
                  disabled={!selectable}
                  accessibilityRole="button"
                  accessibilityLabel={formatDay(iso)}
                  accessibilityState={{ selected, disabled: !selectable }}
                  onPress={() => setPending(iso)}
                  style={[
                    styles.cell,
                    selectable && trip && styles.cellInTrip,
                    selected && styles.cellSelected,
                  ]}>
                  <AppText
                    variant={selectable ? 'bold' : 'regular'}
                    size={12}
                    color={selected ? 'surface' : selectable ? 'ink' : 'disabled'}>
                    {parseIsoDate(iso).getDate()}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {trip && (
        <View style={styles.key}>
          <View style={styles.keyItem}>
            <View style={styles.swatch} />
            <AppText variant="medium" size={9} color="inkMuted" leading={1.35}>
              In itinerary
            </AppText>
          </View>
          <AppText variant="medium" size={9} color="disabled" leading={1.35}>
            Other dates unavailable
          </AppText>
        </View>
      )}

      <ActionButton
        label={`Use ${formatDay(pending)}`}
        trailingIcon="check"
        height={42}
        fontSize={13}
        style={styles.confirm}
        onPress={() => onConfirm(pending)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Palette.coralSoft,
  },
  suggestionText: {
    flex: 1,
    gap: 2,
  },
  monthNav: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendar: {
    gap: 2,
  },
  weekdays: {
    height: 20,
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  week: {
    height: 30,
    flexDirection: 'row',
    gap: 2,
  },
  cell: {
    flex: 1,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  cellInTrip: {
    backgroundColor: Palette.tealMist,
  },
  cellSelected: {
    backgroundColor: Palette.coral,
  },
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: Palette.teal,
  },
  confirm: {
    marginBottom: 4,
  },
});
