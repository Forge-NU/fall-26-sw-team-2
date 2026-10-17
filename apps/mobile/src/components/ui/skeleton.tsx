import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { SkeletonTokens as T } from '@/constants/skeleton-tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  circle?: boolean;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%', height = T.height, circle = false, animate = true, style }: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(T.maxOpacity));
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReduceMotion(value);
    }).catch(() => { /* Keep the static fallback if preference is unavailable. */ });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!animate || reduceMotion) { opacity.setValue(T.maxOpacity); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: T.minOpacity, duration: T.duration, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(opacity, { toValue: T.maxOpacity, duration: T.duration, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); opacity.setValue(T.maxOpacity); };
  }, [animate, reduceMotion, opacity]);

  return <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.block, { width, height, borderRadius: circle && typeof height === 'number' ? height / 2 : T.radius, opacity }, style]} />;
}

const styles = StyleSheet.create({ block: { backgroundColor: T.background } });
