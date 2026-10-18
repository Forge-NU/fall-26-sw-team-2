import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { tintFor } from '@/utils/placeholder';

type MediaProps = {
  /** Picks the placeholder tint, so the same item always looks the same. */
  seed: string;
  /** Photo or video thumbnail; a tinted block is drawn when it is missing or fails to load. */
  url?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function Media({ seed, url, iconSize = 22, style }: MediaProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const showImage = url && url !== failedUrl;

  return (
    <View style={[styles.frame, { backgroundColor: tintFor(seed) }, style]}>
      {showImage ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <View style={styles.placeholderIcon}>
          <Icon name="image" size={iconSize} />
        </View>
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
  placeholderIcon: {
    opacity: 0.45,
  },
});
