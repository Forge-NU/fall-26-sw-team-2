import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Palette, Spacing } from '@/constants/theme';
import { parsePoint } from '@/lib/pin-start';
import type { PinMapProps } from './pin-map';

const format = (n: number) => String(Math.round(n * 1e6) / 1e6);

// react-native-maps has no web support, so the web build (and the PR web
// preview) types the pin's coordinates instead. It starts at the same point
// the map would, so Confirm works right away.
export function PinMap({ start, onCenterChange }: PinMapProps) {
  const [latitude, setLatitude] = useState(() => format(start.center.latitude));
  const [longitude, setLongitude] = useState(() => format(start.center.longitude));
  const valid = parsePoint(latitude, longitude) !== null;

  const update = (lat: string, lng: string) => {
    setLatitude(lat);
    setLongitude(lng);
    onCenterChange(parsePoint(lat, lng));
  };

  return (
    <View style={styles.root}>
      <EmptyState
        icon="map-outline"
        title="The map is in the phone app"
        description="On the web, type where the pin goes."
      />
      <View style={styles.fields}>
        <Input
          label="Latitude"
          value={latitude}
          onChangeText={(text) => update(text, longitude)}
          inputMode="decimal"
          autoCorrect={false}
          accessibilityLabel="Latitude"
        />
        <Input
          label="Longitude"
          value={longitude}
          onChangeText={(text) => update(latitude, text)}
          inputMode="decimal"
          autoCorrect={false}
          accessibilityLabel="Longitude"
        />
        {valid ? null : (
          <AppText variant="label" accessibilityLiveRegion="polite" style={styles.error}>
            Latitude goes from -90 to 90, longitude from -180 to 180.
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: Spacing.four, padding: Spacing.three },
  fields: { gap: Spacing.three },
  error: { color: Palette.coral, textAlign: 'center' },
});
