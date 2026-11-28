import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { SegmentedTokens as T } from '@/constants/segmented-tokens';

export type Segment<K extends string> = { key: K; label: string; leadingIcon?: IconName };

export type SegmentedControlProps<K extends string> = {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
};

/**
 * The iOS-style segmented control: two to five segments on a gray track, the
 * selected one raised in white. The trip page's Posts | Bucket and the search scopes.
 */
export function SegmentedControl<K extends string>({ segments, value, onChange, accessibilityLabel }: SegmentedControlProps<K>) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {segments.map((segment) => {
        const selected = segment.key === value;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(segment.key)}
            style={[styles.segment, selected && styles.selected]}>
            {segment.leadingIcon ? <Icon name={segment.leadingIcon} size={T.iconSize} color="black" /> : null}
            <Text style={[T.typography, styles.label]} numberOfLines={1}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    minHeight: T.height,
    flexDirection: 'row',
    padding: T.padding,
    borderRadius: T.borderRadius,
    backgroundColor: T.track,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.gap,
    borderRadius: T.segmentRadius,
  },
  selected: { backgroundColor: T.selected, ...T.shadow },
  label: { color: T.text },
});
