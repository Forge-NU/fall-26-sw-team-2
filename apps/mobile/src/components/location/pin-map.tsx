import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

import { mapStyle } from '@/components/explore/map-style';
import { PinTokens } from '@/constants/pin-tokens';
import { regionFor } from '@/lib/map-zoom';
import type { LatLng, PinStart } from '@/lib/pin-start';

export type PinMapProps = {
  start: PinStart;
  // The point under the pin, each time the map stops moving. null means there
  // isn't a usable point (only the web fallback sends it).
  onCenterChange: (center: LatLng | null) => void;
};

// The map behind the fixed pin. The pin never moves; the user pans the map
// under it, and the point under its tip is the pin's location.
export function PinMap({ start, onCenterChange }: PinMapProps) {
  // Sized once the map has laid out, so the start region fills it
  const [aspect, setAspect] = useState<number | null>(null);

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (aspect === null && width > 0 && height > 0) setAspect(width / height);
      }}>
      {aspect !== null ? (
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={regionFor(start.center, start.latitudeDelta, aspect)}
          customMapStyle={mapStyle}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          showsUserLocation={start.source === 'device'}
          showsMyLocationButton={false}
          showsPointsOfInterests={false}
          showsCompass={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onRegionChangeComplete={(region) =>
            onCenterChange({ latitude: region.latitude, longitude: region.longitude })
          }
        />
      ) : null}
      {/* The pin's tip sits on the map's center */}
      <View pointerEvents="none" style={styles.pinLayer}>
        <Ionicons
          name="location"
          size={PinTokens.pinSize}
          color={PinTokens.pinColor}
          style={styles.pin}
          accessibilityLabel="Pin, at the center of the map"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pinLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pin: {
    transform: [{ translateY: -PinTokens.pinSize / 2 }],
    shadowColor: PinTokens.pinShadow,
    shadowOpacity: PinTokens.pinShadowOpacity,
    shadowRadius: PinTokens.pinShadowRadius,
    shadowOffset: { width: 0, height: 2 },
  },
});
