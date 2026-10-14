import { Pressable, StyleSheet, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
};

/** 36x22 switch from the story composer wireframe. */
export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 36,
    height: 22,
    borderRadius: Radius.pill,
    padding: 2,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: Palette.coral,
  },
  trackOff: {
    backgroundColor: Palette.border,
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
});
