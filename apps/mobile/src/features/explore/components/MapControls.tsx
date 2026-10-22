import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow } from '../theme';

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
          <MaterialCommunityIcons name="plus" size={26} color={colors.forest} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.btn} onPress={onZoomOut} accessibilityLabel="Zoom out">
          <MaterialCommunityIcons name="minus" size={26} color={colors.forest} />
        </Pressable>
      </View>
      <Pressable style={[styles.single, styles.btn]} onPress={onLocate} accessibilityLabel="Show my location">
        <MaterialCommunityIcons name="crosshairs-gps" size={24} color={colors.coral} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, gap: 12, alignItems: 'center' },
  zoom: { borderRadius: radius.md, backgroundColor: colors.surface, ...shadow },
  single: { borderRadius: radius.md, backgroundColor: colors.surface, ...shadow },
  btn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginHorizontal: 10, backgroundColor: colors.line },
});
