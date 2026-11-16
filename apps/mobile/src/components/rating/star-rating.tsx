import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ContentTokens } from '@/constants/content-tokens';
import { Palette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';

const STARS = [1, 2, 3, 4, 5] as const;

export type StarRatingProps = {
  /** 1-5, a place's average (halves show as half stars), or null for none */
  value: number | null;
  /** Makes the stars tappable. Tapping the current rating clears it. */
  onChange?: (value: number | null) => void;
  size?: number;
  disabled?: boolean;
};

/**
 * Five stars, for a post's rating and a place's average.
 * STAND-IN for RATE-2 (#92): swap in its StarRating once that lands.
 */
export function StarRating({ value, onChange, size = 16, disabled = false }: StarRatingProps) {
  if (!onChange) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={value == null ? 'Not rated' : `${formatStars(value)} out of 5 stars`}
        style={styles.row}>
        {STARS.map((star) => (
          <Ionicons key={star} name={glyph(value, star)} size={size} color={Palette.coral} />
        ))}
      </View>
    );
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Rating" style={[styles.row, styles.inputRow]}>
      {STARS.map((star) => {
        const selected = value === star;
        return (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
            accessibilityHint={selected ? 'Clears the rating' : undefined}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            hitSlop={Spacing.one}
            onPress={() => onChange(selected ? null : star)}
            style={({ pressed }) => [styles.input, pressed && styles.pressed]}>
            <Ionicons name={glyph(value, star)} size={size} color={Palette.coral} />
          </Pressable>
        );
      })}
    </View>
  );
}

function glyph(value: number | null, star: number): 'star' | 'star-half' | 'star-outline' {
  if (value == null) return 'star-outline';
  if (value >= star) return 'star';
  return value >= star - 0.5 ? 'star-half' : 'star-outline';
}

/** "4" or "4.3", the way averages come back rounded to one decimal */
export function formatStars(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  inputRow: { gap: 0 },
  input: {
    minWidth: ContentTokens.actionSize,
    minHeight: ContentTokens.actionSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
