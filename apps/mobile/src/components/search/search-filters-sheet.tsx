import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Palette, Radii, Spacing } from '@/constants/theme';
import {
  applicableFilters, defaultSearchFilters, filterError,
  type SearchCenters, type SearchFilters, type SearchTab,
} from '@/lib/search/filters';

type Props = {
  visible: boolean;
  onClose: () => void;
  tab: SearchTab;
  value: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  centers: SearchCenters;
  onRequestLocation: () => void;
  locating?: boolean;
};

/** Controlled panel: requests and location permission belong to the caller.
 * Selections apply immediately; Done closes the panel. */
export function SearchFiltersSheet({ visible, onClose, tab, value, onChange, centers, onRequestLocation, locating }: Props) {
  const { height } = useWindowDimensions();
  const show = applicableFilters(tab);
  const error = filterError(value, tab, centers);
  const update = (patch: Partial<SearchFilters>) => onChange({ ...value, ...patch });
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filters">
      <ScrollView style={[styles.scroll, { maxHeight: height * 0.6 }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {show.dates && <Group title="Dates">
          <View style={styles.row}>
            <DateField label="From" value={value.from} onChange={from => update({ from })} />
            <DateField label="To" value={value.to} onChange={to => update({ to })} />
          </View>
          <Choice label="Any dates" selected={!value.from && !value.to} onPress={() => update({ from: null, to: null })} />
        </Group>}
        {show.rating && <Group title="Minimum rating">
          <View style={styles.row}>
            {([null, 3, 4, 4.5] as const).map(rating => <Choice key={String(rating)} label={rating === null ? 'Any' : `${rating}+`}
              selected={value.minRating === rating} onPress={() => update({ minRating: rating })} />)}
          </View>
        </Group>}
        {show.distance && <Group title="Distance">
          <View style={styles.row}>
            {([null, 1, 5, 10, 50] as const).map(radiusKm => <Choice key={String(radiusKm)} label={radiusKm === null ? 'Anywhere' : `${radiusKm} km`}
              selected={value.radiusKm === radiusKm} onPress={() => update({ radiusKm })} />)}
          </View>
          <View style={styles.row}>
            <Choice label={locating ? 'Finding location…' : 'Near me'} selected={value.distanceSource === 'nearMe'}
              disabled={centers.permission === 'denied' || locating} onPress={() => {
                update({ distanceSource: 'nearMe' });
                if (centers.permission !== 'granted' || !centers.nearMe) onRequestLocation();
              }} />
            <Choice label="Near the map’s center" selected={value.distanceSource === 'mapCenter'}
              onPress={() => update({ distanceSource: 'mapCenter' })} />
          </View>
          {centers.permission === 'denied' && <AppText variant="caption" color="placeholderGray">
            Location access is off. Use the map’s center, or allow location in your device settings.
          </AppText>}
        </Group>}
        <Group title="Sort">
          <View style={styles.row}>
            <Choice label="Most relevant" selected={value.sort === 'relevance'} onPress={() => update({ sort: 'relevance' })} />
            <Choice label="Newest" selected={value.sort === 'newest'} onPress={() => update({ sort: 'newest' })} />
          </View>
        </Group>
        {error && <AppText variant="caption" color="coral" accessibilityLiveRegion="polite">{error}</AppText>}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Reset" size="compact" onPress={() => onChange(defaultSearchFilters())} />
        <Button title="Done" size="compact" variant="teal" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.group}><AppText variant="label">{title}</AppText>{children}</View>;
}
function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choice, selected && styles.selected, (disabled || pressed) && styles.dimmed]}>
    <AppText variant="caption" color={selected ? 'black' : 'placeholderGray'}>{label}</AppText>
  </Pressable>;
}
const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { gap: Spacing.four, paddingBottom: Spacing.three },
  group: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: Palette.peach, borderRadius: Radii.pill, paddingHorizontal: Spacing.three },
  selected: { backgroundColor: Palette.peach, borderColor: Palette.coral },
  dimmed: { opacity: 0.5 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingBottom: Spacing.two },
});
