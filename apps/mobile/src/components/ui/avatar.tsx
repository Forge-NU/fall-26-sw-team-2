import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { initialsFor, tintFor } from '@/utils/placeholder';

type AvatarProps = {
  name: string;
  /** Profile photo; initials are drawn when it is missing or fails to load. */
  url?: string;
  size: number;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ name, url, size, style }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const frame = { width: size, height: size, borderRadius: size / 2 };
  const showImage = url && url !== failedUrl;

  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[styles.frame, frame, { backgroundColor: tintFor(name) }, style]}>
      {showImage ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        // Tiny avatars only have room for one letter.
        <AppText variant="bold" size={Math.round(size * 0.4)}>
          {initialsFor(name, size < 24 ? 1 : 2)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
