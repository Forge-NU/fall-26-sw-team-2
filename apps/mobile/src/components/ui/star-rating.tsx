import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { AppText } from '@/components/ui/app-text';
import { RatingTokens, type RatingSize } from '@/constants/rating-tokens';
import {
  formatRating,
  RATING_MAX,
  ratingLabel,
  ratingValueText,
  starFills,
  stepRating,
  tapRating,
  type StarFill,
} from '@/lib/rating';

type CommonProps = {
  /** 1-5 for a post, a place's average (shows half stars), or null for none */
  value: number | null;
  size?: RatingSize;
  style?: StyleProp<ViewStyle>;
};

type DisplayProps = CommonProps & {
  /** How many posts the average comes from, for a place */
  count?: number;
  /** Shows "4.3 · 12" (or "4" with no count) after the stars */
  showLabel?: boolean;
  onChange?: never;
};

type InputProps = CommonProps & {
  /** Gets the new rating, or null when the current star is tapped again */
  onChange: (value: number | null) => void;
  disabled?: boolean;
  /** What screen readers call the input, e.g. "Rate this place" */
  accessibilityLabel?: string;
};

export type StarRatingProps = DisplayProps | InputProps;

const GLYPHS: Record<StarFill, IconName> = { full: 'star', half: 'star-half', empty: 'star-outline' };
const STARS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

/**
 * Five stars for a post's rating or a place's average (RATE-2 #92).
 * Pass onChange to make it an input: tap a star to set it, tap it again to clear.
 * Shared by post screens, the map (MAP-3) and search (SRCH-4).
 */
export function StarRating(props: StarRatingProps) {
  return props.onChange ? <RatingInput {...props} /> : <RatingDisplay {...props} />;
}

function Star({ fill, size }: { fill: StarFill; size: RatingSize }) {
  return (
    <Icon
      name={GLYPHS[fill]}
      size={RatingTokens.sizes[size]}
      color={fill === 'empty' ? RatingTokens.emptyColor : RatingTokens.filledColor}
    />
  );
}

function RatingDisplay({ value, count, showLabel = false, size = 'small', style }: DisplayProps) {
  const label =
    showLabel && value != null ? [formatRating(value), count?.toLocaleString('en-US')].filter(Boolean).join(' · ') : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={ratingLabel(value, count)}
      style={[styles.display, style]}>
      <View style={styles.stars}>
        {starFills(value).map((fill, i) => (
          <Star key={i} fill={fill} size={size} />
        ))}
      </View>
      {label ? (
        <AppText variant="caption" color={RatingTokens.labelColor}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

function RatingInput({
  value,
  onChange,
  disabled = false,
  accessibilityLabel = 'Rating',
  size = 'large',
  style,
}: InputProps) {
  const fills = starFills(value);
  // Each star sits in a tap target bigger than itself. Pull the row in by the
  // difference so the stars' visible edges line up with the content around them.
  const inset = { marginHorizontal: -(RatingTokens.inputTarget - RatingTokens.sizes[size]) / 2 };

  return (
    // One adjustable control for screen readers: it reads "3 of 5 stars" and
    // swiping up or down changes it. The stars inside are for touch.
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      // aria-valuetext, not accessibilityValue: react-native-web drops the latter
      aria-valuetext={ratingValueText(value)}
      accessibilityHint="Swipe up or down to change. Swipe down from 1 star to clear."
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        const step = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : null;
        if (step) onChange(stepRating(value, step));
      }}
      style={[styles.stars, inset, disabled && styles.disabled, style]}>
      {STARS.map((star) => (
        <Pressable
          key={star}
          accessible={false}
          disabled={disabled}
          onPress={() => onChange(tapRating(value, star))}
          style={({ pressed }) => [styles.target, pressed && styles.pressed]}>
          <Star fill={fills[star - 1]} size={size} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  display: { flexDirection: 'row', alignItems: 'center', gap: RatingTokens.labelGap },
  stars: { flexDirection: 'row', alignItems: 'center', gap: RatingTokens.gap },
  target: {
    minWidth: RatingTokens.inputTarget,
    minHeight: RatingTokens.inputTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: RatingTokens.pressedOpacity },
  disabled: { opacity: RatingTokens.disabledOpacity },
});
