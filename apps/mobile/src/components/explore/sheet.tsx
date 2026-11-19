import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { MapTokens } from '@/constants/map-tokens';
import { ShadowTokens } from '@/constants/shadow-tokens';
import { SheetTokens } from '@/constants/sheet-tokens';
import { Palette, Radii, Spacing } from '@/constants/theme';

interface Props {
  /** Owned by the screen so map controls can move with the sheet. */
  height: Animated.Value;
  /** Heights in points, smallest first, e.g. [half, full]. */
  snapPoints: number[];
  snapIndex: number;
  /** Change this when the sheet shows new content to replay the open animation. */
  contentKey: string;
  onDismiss: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

function springTo(value: Animated.Value, toValue: number) {
  Animated.spring(value, { toValue, useNativeDriver: false, stiffness: 260, damping: 30, mass: 0.9 }).start();
}

export function Sheet({ height, snapPoints, snapIndex, contentKey, onDismiss, footer, children }: Props) {
  const snapsRef = useRef(snapPoints);
  const dismissRef = useRef(onDismiss);
  const startRef = useRef(0);
  const valueRef = useRef(0);

  useEffect(() => {
    snapsRef.current = snapPoints;
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    const id = height.addListener(({ value }) => {
      valueRef.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);

  const target = snapPoints[Math.min(snapIndex, snapPoints.length - 1)];
  useEffect(() => {
    springTo(height, target);
  }, [contentKey, target, height]);

  // Drag the handle to resize, flick down to close, tap to toggle half/full.
  // The handlers read the refs only during a drag, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        height.stopAnimation();
        startRef.current = valueRef.current;
      },
      onPanResponderMove: (_e, g) => {
        const snaps = snapsRef.current;
        const max = snaps[snaps.length - 1];
        height.setValue(Math.max(0, Math.min(max, startRef.current - g.dy)));
      },
      onPanResponderRelease: (_e, g) => {
        const snaps = snapsRef.current;
        const max = snaps[snaps.length - 1];
        if (Math.abs(g.dy) < 4 && Math.abs(g.vy) < 0.1) {
          springTo(height, startRef.current >= max - 4 ? snaps[0] : max);
          return;
        }
        const projected = valueRef.current - g.vy * 150;
        if (projected < snaps[0] * 0.6) {
          dismissRef.current();
          return;
        }
        const next = snaps.reduce(
          (best, pt) => (Math.abs(pt - projected) < Math.abs(best - projected) ? pt : best),
          snaps[0],
        );
        springTo(height, next);
      },
    }),
  );

  return (
    <Animated.View style={[styles.sheet, { height }]}>
      <View style={styles.grabZone} {...pan.panHandlers} accessibilityLabel="Resize panel" accessibilityRole="adjustable">
        <View style={styles.grabber} />
      </View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Same corners, handle and background as BottomSheet, but it stays open over the map
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderTopLeftRadius: SheetTokens.radius,
    borderTopRightRadius: SheetTokens.radius,
    backgroundColor: SheetTokens.background,
    ...ShadowTokens.floating,
  },
  grabZone: { height: MapTokens.handleZone, alignItems: 'center', justifyContent: 'center' },
  grabber: {
    width: SheetTokens.handle.width,
    height: SheetTokens.handle.height,
    borderRadius: Radii.circle,
    backgroundColor: SheetTokens.handle.color,
  },
  body: { flex: 1 },
  footer: {
    paddingHorizontal: SheetTokens.paddingHorizontal,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Palette.peach,
    backgroundColor: SheetTokens.background,
  },
});
