import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PlaceSaveTokens as T } from '@/constants/place-save-tokens';
import { AnimatedPressable, usePressScale } from './press-scale';

export type PlaceSaveProps = {
  /** The signed-in person has this place saved anywhere (My places or a trip's Bucket) */
  saved: boolean;
  /** Always opens the Save a place sheet (PLACE-2 #139), saved or not */
  onPress: () => void;
  placeName?: string;
};

/** The small + after a place name; a coral check once saved. A 44 point tap area. */
export function PlaceSave({ saved, onPress, placeName }: PlaceSaveProps) {
  const squish = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${saved ? 'Saved' : 'Save'}${placeName ? ` ${placeName}` : ''}`}
      accessibilityHint="Choose where to save this place"
      onPress={onPress}
      onPressIn={squish.pressIn}
      onPressOut={squish.pressOut}
      style={[styles.hit, squish.animatedStyle]}>
      <View style={[styles.ring, saved && styles.saved]}>
        <Icon name={saved ? 'check' : 'plus'} size={T.iconSize} color={saved ? 'white' : 'neutral700'} />
      </View>
    </AnimatedPressable>
  );
}


const styles = StyleSheet.create({
  hit: { width: T.hitArea, height: T.hitArea, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: T.ring,
    height: T.ring,
    borderRadius: T.ring / 2,
    borderWidth: T.ringWidth,
    borderColor: T.ringColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saved: { backgroundColor: T.savedBackground, borderColor: T.savedBackground },
});
