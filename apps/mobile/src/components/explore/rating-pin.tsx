import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { MapTokens } from '@/constants/map-tokens';
import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { formatCount } from '@/utils/format-count';
import type { PinItem } from '@/components/explore/types';

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
              <MaterialCommunityIcons name="star" size={18} color={Palette.coral} />
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
              <MaterialCommunityIcons name="star" size={11 + weight * 4} color={Palette.coral} />
              <Text allowFontScaling={false} style={[styles.rating, { fontSize: MapTokens.pin.ratingSize + weight * MapTokens.pin.ratingGrowth }]}>
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

const halo = { textShadowColor: MapTokens.pin.halo, textShadowRadius: Spacing.one, textShadowOffset: { width: 0, height: 0 } };

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'flex-end', paddingVertical: PAD },
  label: {
    ...Typography.label,
    height: LABEL_H,
    lineHeight: LABEL_H,
    maxWidth: FRAME_W - Spacing.two,
    color: Palette.black,
    ...halo,
  },
  reviews: {
    ...Typography.caption,
    fontFamily: Typography.body.fontFamily,
    fontSize: MapTokens.pin.reviewsSize,
    height: REVIEWS_H,
    lineHeight: REVIEWS_H - Spacing.one,
    color: Palette.placeholderGray,
    ...halo,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    backgroundColor: Palette.warmWhite,
    borderWidth: 1,
    borderColor: Palette.lightPink,
  },
  rating: { fontFamily: Typography.button.fontFamily, color: Palette.black },
  tail: {
    width: TAIL_H * 2,
    height: TAIL_H * 2,
    marginTop: -TAIL_H,
    marginBottom: 0,
    transform: [{ rotate: '45deg' }],
    backgroundColor: Palette.warmWhite,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Palette.lightPink,
  },
  callout: {
    width: CALLOUT_W,
    height: CALLOUT_H,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radii.pill,
    backgroundColor: Palette.warmWhite,
    borderWidth: 1,
    borderColor: Palette.lightPink,
  },
  calloutTitle: { ...Typography.label, fontSize: Typography.body.fontSize, lineHeight: MapTokens.pin.calloutLineHeight, color: Palette.black },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  calloutRating: { ...Typography.subheading, fontFamily: Typography.button.fontFamily, color: Palette.black },
  calloutMeta: { ...Typography.label, fontFamily: Typography.body.fontFamily, flexShrink: 1, color: Palette.placeholderGray, marginLeft: Spacing.half },
});
