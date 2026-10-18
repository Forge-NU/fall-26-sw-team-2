import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  AvatarTokens,
  type AvatarSize,
} from '@/constants/avatar-tokens';

export type AvatarProps = {
  name?: string;
  uri?: string | null;
  size?: AvatarSize;
};

export function Avatar({
  name = '',
  uri,
  size = 'medium',
}: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const dimensions = AvatarTokens.sizes[size];
  const imageUri = uri?.trim();
  const showImage = Boolean(imageUri && imageUri !== failedUri);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        name.trim() ? `${name.trim()} avatar` : 'User avatar'
      }
      style={[
        styles.container,
        {
          width: dimensions.diameter,
          height: dimensions.diameter,
          borderRadius: dimensions.diameter / 2,
        },
      ]}>
      {showImage ? (
        <Image
          key={imageUri}
          source={{ uri: imageUri }}
          resizeMode="cover"
          style={styles.image}
          onError={() => setFailedUri(imageUri ?? null)}
        />
      ) : size !== 'compact' ? (
        <Ionicons
          name="person-outline"
          size={dimensions.diameter * 0.55}
          color={AvatarTokens.iconColor}
          accessible={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AvatarTokens.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
