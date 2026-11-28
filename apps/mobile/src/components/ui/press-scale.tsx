import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// The press squish: buttons and cards shrink a little the instant a finger
// lands and spring back on release, with no bounce. With Reduce Motion on,
// they dim instead of moving.
const PRESSED_SCALE = 0.97;
const PRESSED_OPACITY = 0.7;
const SPRING = { damping: 30, stiffness: 400, mass: 1 } as const;

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function usePressScale(enabled = true) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - pressed.value * (1 - PRESSED_OPACITY) }
      : { transform: [{ scale: 1 - pressed.value * (1 - PRESSED_SCALE) }] },
  );

  return {
    animatedStyle,
    pressIn: () => {
      if (!enabled) return;
      pressed.value = reduceMotion ? withTiming(1, { duration: 80 }) : withSpring(1, SPRING);
    },
    pressOut: () => {
      pressed.value = reduceMotion ? withTiming(0, { duration: 120 }) : withSpring(0, SPRING);
    },
  };
}
