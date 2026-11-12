import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { MapTokens } from '@/constants/map-tokens';
import { ShadowTokens } from '@/constants/shadow-tokens';
import { Palette, Radii, Spacing } from '@/constants/theme';

interface Props {
  bottom: number;
  translateY: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}

export function MapControls({ bottom, translateY, opacity, onZoomIn, onZoomOut, onLocate }: Props) {
  return (
    <Animated.View style={[styles.wrap, { bottom, opacity, transform: [{ translateY }] }]} pointerEvents="box-none">
      <View style={styles.zoom}>
        <Pressable style={styles.btn} onPress={onZoomIn} accessibilityLabel="Zoom in">
          <MaterialCommunityIcons name="plus" size={26} color={Palette.black} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.btn} onPress={onZoomOut} accessibilityLabel="Zoom out">
          <MaterialCommunityIcons name="minus" size={26} color={Palette.black} />
        </Pressable>
      </View>
      <Pressable style={[styles.single, styles.btn]} onPress={onLocate} accessibilityLabel="Show my location">
        <MaterialCommunityIcons name="crosshairs-gps" size={24} color={Palette.coral} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: Spacing.three, gap: Spacing.two, alignItems: 'center' },
  zoom: { borderRadius: Radii.pill, backgroundColor: Palette.white, ...ShadowTokens.floating },
  single: { borderRadius: Radii.pill, backgroundColor: Palette.white, ...ShadowTokens.floating },
  btn: { width: MapTokens.controlSize, height: MapTokens.controlSize, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginHorizontal: Spacing.two, backgroundColor: Palette.peach },
});
