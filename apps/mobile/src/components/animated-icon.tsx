import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Theme } from '@/constants/theme';

const DURATION = 600;
// Same size as `imageWidth` for expo-splash-screen in app.json, so the native
// splash and this overlay line up
const LOGO_SIZE = 90;

const fadeOut = new Keyframe({
  0: { opacity: 1 },
  20: { opacity: 1 },
  70: { opacity: 0, easing: Easing.elastic(0.7) },
  100: { opacity: 0, easing: Easing.elastic(0.7) },
});

// Copy of the native splash that fades out once the app has rendered
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const logo = <Image style={styles.logo} source={require('@/assets/images/yuji/logo.png')} />;

  return animate ? (
    <Animated.View
      entering={fadeOut.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.overlay}>
      {logo}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.overlay}>
      {logo}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
