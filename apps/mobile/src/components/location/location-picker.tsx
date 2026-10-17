import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { newSearchSessionToken, resolveLocation, retrievePlace } from '@/api/locations';
import type { PlaceSuggestion, ResolveLocationResponse } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast-provider';
import { MIN_PLACE_QUERY, usePlaceSearch } from '@/hooks/use-place-search';
import { InputTokens } from '@/constants/input-tokens';
import { Palette } from '@/constants/palette';
import { MaxContentWidth, Radii, Spacing, Theme } from '@/constants/theme';

// What the picker returns: a shared Mapbox location row, or a custom name
export type PickedLocation = ResolveLocationResponse;

export const CUSTOM_LOCATION_MAX = 100;

export function locationName(value: PickedLocation): string {
  return value.kind === 'mapbox' ? value.location.name : value.name;
}

// The location fields for POST /api/posts and POST /api/stories
export function toLocationFields(
  value: PickedLocation,
): { locationId: string } | { customLocationName: string } {
  return value.kind === 'mapbox' ? { locationId: value.location.id } : { customLocationName: value.name };
}

export type LocationPickerProps = {
  value: PickedLocation | null;
  onChange: (value: PickedLocation | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
};

// Location field + search sheet, shared by the post composer (#42) and the
// story composer (#24). Searches Mapbox, or lets the user type a custom name,
// then resolves the pick through LOC-1 so the value is ready to send.
export function LocationPicker({
  value,
  onChange,
  label = 'Location',
  placeholder = 'Add a place',
  error,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const subtitle =
    value?.kind === 'mapbox'
      ? [value.location.city, value.location.countryCode].filter(Boolean).join(', ')
      : value
        ? 'Custom location'
        : null;

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${locationName(value)}. Change` : `${label}: ${placeholder}`}
        onPress={() => setOpen(true)}
        style={[styles.field, error ? styles.fieldError : null]}>
        <Ionicons name="location-outline" size={18} color={Palette.coral} />
        <View style={styles.fieldText}>
          <AppText numberOfLines={1} style={!value && styles.placeholder}>
            {value ? locationName(value) : placeholder}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" numberOfLines={1} style={styles.secondary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove location"
            hitSlop={Spacing.two}
            onPress={() => onChange(null)}>
            <Ionicons name="close-circle" size={18} color={Palette.placeholderGray} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={Palette.placeholderGray} />
        )}
      </Pressable>
      {error ? (
        <AppText variant="label" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      {open ? (
        <LocationSearchSheet
          onClose={() => setOpen(false)}
          onPick={(picked) => {
            onChange(picked);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

type LocationSearchSheetProps = {
  onPick: (value: PickedLocation) => void;
  onClose: () => void;
};

type Row = { type: 'custom'; name: string } | { type: 'place'; place: PlaceSuggestion };

function LocationSearchSheet({ onPick, onClose }: LocationSearchSheetProps) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [sessionToken] = useState(newSearchSessionToken);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const { suggestions, searching, error } = usePlaceSearch(query, sessionToken);

  const typed = query.trim();
  const customTooLong = [...typed].length > CUSTOM_LOCATION_MAX;
  const rows: Row[] = [
    ...(typed ? [{ type: 'custom' as const, name: typed }] : []),
    ...suggestions.map((place) => ({ type: 'place' as const, place })),
  ];

  const pick = async (row: Row) => {
    if (resolvingKey) return;
    if (row.type === 'custom' && customTooLong) return;
    const key = row.type === 'custom' ? 'custom' : row.place.mapboxId;
    setResolvingKey(key);
    try {
      const body =
        row.type === 'custom'
          ? { kind: 'custom' as const, name: row.name }
          : await retrievePlace(row.place.mapboxId, sessionToken);
      onPick(await resolveLocation(body));
    } catch {
      showToast({ message: "Couldn't add that place. Try again.", variant: 'error' });
      setResolvingKey(null);
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.sheet}>
        <View style={styles.sheetContent}>
          <ScreenHeader
            title="Add location"
            left={{ icon: 'close', label: 'Close', onPress: onClose }}
          />
          <Input
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search places"
            accessibilityLabel="Search places"
            returnKeyType="search"
            autoCorrect={false}
          />
          <FlatList
            data={rows}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(row) => (row.type === 'custom' ? 'custom' : row.place.mapboxId)}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={
              typed.length > 0 && typed.length < MIN_PLACE_QUERY ? (
                <AppText variant="caption" style={styles.hint}>
                  Keep typing to search places
                </AppText>
              ) : null
            }
            ListFooterComponent={
              searching ? (
                <ActivityIndicator style={styles.hint} color={Palette.coral} />
              ) : error ? (
                <AppText variant="caption" style={styles.hint}>
                  Search isn&apos;t working right now. You can still use a custom name.
                </AppText>
              ) : typed.length >= MIN_PLACE_QUERY && suggestions.length === 0 ? (
                <AppText variant="caption" style={styles.hint}>
                  No places found. Use the name you typed instead.
                </AppText>
              ) : null
            }
            renderItem={({ item }) => {
              const key = item.type === 'custom' ? 'custom' : item.place.mapboxId;
              const disabled = item.type === 'custom' && customTooLong;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => void pick(item)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <Ionicons
                    name={item.type === 'custom' ? 'create-outline' : 'location-outline'}
                    size={18}
                    color={item.type === 'custom' ? Palette.coral : Palette.black}
                  />
                  <View style={styles.rowText}>
                    {item.type === 'custom' ? (
                      <>
                        <AppText variant="label" numberOfLines={1}>
                          Use “{item.name}”
                        </AppText>
                        <AppText variant="caption" style={styles.secondary}>
                          {disabled
                            ? `Custom names can be up to ${CUSTOM_LOCATION_MAX} characters`
                            : "Custom location. It won't show on the map."}
                        </AppText>
                      </>
                    ) : (
                      <>
                        <AppText variant="label" numberOfLines={1}>
                          {item.place.name}
                        </AppText>
                        {item.place.description ? (
                          <AppText variant="caption" numberOfLines={1} style={styles.secondary}>
                            {item.place.description}
                          </AppText>
                        ) : null}
                      </>
                    )}
                  </View>
                  {resolvingKey === key ? <ActivityIndicator color={Palette.coral} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: InputTokens.gap },
  label: { textAlign: 'center' },
  field: {
    minHeight: InputTokens.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: InputTokens.borderWidth,
    borderColor: InputTokens.border,
    borderRadius: InputTokens.borderRadius,
    paddingHorizontal: InputTokens.paddingHorizontal,
    paddingVertical: Spacing.one,
    backgroundColor: InputTokens.background,
  },
  fieldError: { borderColor: InputTokens.errorBorder, borderWidth: InputTokens.focusedBorderWidth },
  fieldText: { flex: 1, minWidth: 0 },
  placeholder: { color: InputTokens.placeholder },
  secondary: { color: Palette.placeholderGray },
  error: { color: InputTokens.errorBorder },
  sheet: { flex: 1, backgroundColor: Theme.colors.background },
  sheetContent: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Radii.medium,
  },
  rowText: { flex: 1, minWidth: 0 },
  separator: { height: 1, backgroundColor: Palette.peach },
  hint: { paddingVertical: Spacing.three, textAlign: 'center', color: Palette.placeholderGray },
  pressed: { backgroundColor: Palette.peach },
});
