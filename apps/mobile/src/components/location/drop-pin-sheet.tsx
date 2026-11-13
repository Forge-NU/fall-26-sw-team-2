import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

import { resolveLocation } from '@/api/locations';
import { PinMap } from '@/components/location/pin-map';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-provider';
import { PinTokens } from '@/constants/pin-tokens';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { usePinStart } from '@/hooks/use-pin-start';
import type { PickedLocation } from '@/lib/picked-location';
import { roundPoint, type LatLng, type PinStartTrip } from '@/lib/pin-start';

export type DropPinSheetProps = {
  // The name typed in the search sheet
  name: string;
  // The post's or story's trip, for where the map starts without location permission
  trip: PinStartTrip | null;
  onPick: (value: PickedLocation) => void;
  onClose: () => void;
};

// "Drop a pin" from the location picker (#94 LOC-2): a full-screen map with a
// fixed pin in the middle. The user pans the map under it, and Confirm makes
// the pin (POST /api/locations/resolve with kind 'pin'). A modal rather than a
// route, since it opens from the picker's own modal.
export function DropPinSheet({ name, trip, onPick, onClose }: DropPinSheetProps) {
  const { showToast } = useToast();
  const start = usePinStart(trip);
  // Until the map moves, the pin is where it started
  const [moved, setMoved] = useState<LatLng | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const center = moved === undefined ? (start?.center ?? null) : moved;

  const confirm = async () => {
    if (!center || saving) return;
    setSaving(true);
    try {
      onPick(await resolveLocation({ kind: 'pin', name, ...roundPoint(center) }));
    } catch {
      showToast({ message: "Couldn't drop the pin. Try again.", variant: 'error' });
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Screen
        header={<ScreenHeader title="Drop a pin" left={{ icon: 'arrow-left', label: 'Back', onPress: onClose }} />}>
        <View style={styles.name}>
          <AppText variant="label" numberOfLines={1}>
            {name}
          </AppText>
          {/* The web fallback explains itself */}
          {Platform.OS === 'web' ? null : (
            <AppText variant="caption" style={styles.secondary}>
              Move the map to put the pin on the spot.
            </AppText>
          )}
        </View>

        <View style={styles.map}>
          {start ? (
            <PinMap start={start} onCenterChange={setMoved} />
          ) : (
            <View accessibilityLabel="Loading the map" accessibilityState={{ busy: true }} style={styles.loading}>
              <Skeleton height="100%" />
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.hint} accessibilityRole="text">
            <Ionicons name="eye-outline" size={16} color={Palette.placeholderGray} />
            <AppText variant="caption" style={styles.secondary}>
              Anyone can see this pin.
            </AppText>
          </View>
          <Button
            title="Confirm pin"
            loading={saving}
            disabled={!center}
            onPress={() => void confirm()}
            style={styles.confirm}
          />
        </View>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  name: { alignItems: 'center', gap: Spacing.half },
  secondary: { color: Palette.placeholderGray },
  map: {
    flex: 1,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: PinTokens.mapBorder,
    overflow: 'hidden',
  },
  loading: { flex: 1 },
  footer: { gap: Spacing.two },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  confirm: { width: '100%' },
});
