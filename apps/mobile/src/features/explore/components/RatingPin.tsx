import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { colors, formatCount } from '../theme';
import type { PinItem } from '../types';

interface Props {
  item: PinItem;
  /** 0–1, reviews relative to the busiest visible pin. Bigger bubble = more reviews. */
  weight: number;
  selected: boolean;
  /** Second line of the selected callout, e.g. "6 friends visited". */
  calloutLine?: string;
  onPress: (item: PinItem) => void;
}

// Fixed sizes so the pin's tip lands exactly on its coordinate and the whole
// pin (label, bubble and tail) is one tap target.
const FRAME_W = 150;
const LABEL_H = 18;
const REVIEWS_H = 16;
const TAIL_H = 6;
const PAD = 4;
const CALLOUT_W = 230;
const CALLOUT_H = 88;

function RatingPinBase({ item, weight, selected, calloutLine, onPress }: Props) {
  const size = Math.round(40 + weight * 20); // 40–60pt
  const rating = item.stats.rating.toFixed(1);
  const showReviews = item.kind !== 'place';

  const width = selected ? CALLOUT_W : FRAME_W;
  const height = selected
    ? CALLOUT_H + TAIL_H + PAD * 2
    : PAD + LABEL_H + (showReviews ? REVIEWS_H : 0) + size + TAIL_H + PAD;

  // Android snapshots custom marker views. Track changes briefly after a visual
  // change, then stop so pins don't re-render on every frame.
  const viewKey = `${selected}-${rating}-${item.stats.reviews}-${size}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSettledKey(viewKey), 500);
    return () => clearTimeout(t);
  }, [viewKey]);

  return (
    <Marker
      coordinate={item.coordinate}
      anchor={{ x: 0.5, y: 1 }} // Google Maps: bottom-center sits on the coordinate
      centerOffset={{ x: 0, y: -height / 2 }} // Apple Maps: same thing, expressed as an offset
      stopPropagation
      tracksViewChanges={settledKey !== viewKey}
      zIndex={selected ? 1000 : Math.round(weight * 100)}
      onPress={() => onPress(item)}
      accessibilityLabel={`${item.name}, rated ${rating}, ${item.stats.reviews} reviews`}
    >
      <View style={[styles.frame, { width, height }]}>
        {selected ? (
          <View style={styles.callout}>
            <Text allowFontScaling={false} style={styles.calloutTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.row}>
              <MaterialCommunityIcons name="star" size={18} color={colors.star} />
              <Text allowFontScaling={false} style={styles.calloutRating}>
                {rating}
              </Text>
              {calloutLine ? (
                <Text allowFontScaling={false} style={styles.calloutMeta} numberOfLines={1}>
                  · {calloutLine}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <Text allowFontScaling={false} style={styles.label} numberOfLines={1}>
              {item.name}
            </Text>
            {showReviews && (
              <Text allowFontScaling={false} style={styles.reviews}>
                {formatCount(item.stats.reviews)} reviews
              </Text>
            )}
            <View style={[styles.bubble, { height: size, minWidth: size, borderRadius: size / 2 }]}>
              <MaterialCommunityIcons name="star" size={11 + weight * 4} color={colors.star} />
              <Text allowFontScaling={false} style={[styles.rating, { fontSize: 15 + weight * 5 }]}>
                {rating}
              </Text>
            </View>
          </>
        )}
        <View style={styles.tail} />
      </View>
    </Marker>
  );
}

export const RatingPin = memo(RatingPinBase);

const halo = { textShadowColor: 'rgba(255,255,255,0.95)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } };

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'flex-end', paddingVertical: PAD },
  label: {
    height: LABEL_H,
    lineHeight: LABEL_H,
    maxWidth: FRAME_W - 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.forest,
    ...halo,
  },
  reviews: { height: REVIEWS_H, lineHeight: REVIEWS_H - 4, fontSize: 11, color: colors.textMuted, ...halo },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#DED8CD',
  },
  rating: { fontWeight: '700', color: colors.forest },
  tail: {
    width: 12,
    height: 12,
    marginTop: -TAIL_H,
    marginBottom: 0,
    transform: [{ rotate: '45deg' }],
    backgroundColor: colors.cream,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DED8CD',
  },
  callout: {
    width: CALLOUT_W,
    height: CALLOUT_H,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#DED8CD',
  },
  calloutTitle: { fontSize: 16, fontWeight: '600', color: colors.forest, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calloutRating: { fontSize: 18, fontWeight: '700', color: colors.forest },
  calloutMeta: { flexShrink: 1, fontSize: 14, color: colors.textMuted, marginLeft: 2 },
});
