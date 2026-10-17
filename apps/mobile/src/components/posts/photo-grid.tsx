import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';

export type GridPhoto = {
  uri: string;
  // Upload state, once the post is being sent
  state?: 'pending' | 'uploaded' | 'failed';
};

export type PhotoGridProps = {
  photos: GridPhoto[];
  max: number;
  adding?: boolean;
  disabled?: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

const COLUMNS = 4;

// Picked photos in carousel order. The first one is the post's cover.
export function PhotoGrid({ photos, max, adding = false, disabled = false, onAdd, onRemove }: PhotoGridProps) {
  const [width, setWidth] = useState(0);
  const canAdd = photos.length < max && !disabled;
  const size = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const cellSize = { width: size, height: size };

  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {photos.map((photo, index) => (
        <View key={`${photo.uri}-${index}`} style={[styles.cell, cellSize]}>
          <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors />
          {index === 0 ? (
            <View style={styles.cover}>
              <AppText variant="caption" style={styles.coverText}>
                Cover
              </AppText>
            </View>
          ) : null}
          {photo.state === 'uploaded' ? (
            <View style={[styles.badge, styles.uploaded]}>
              <Ionicons name="checkmark" size={12} color={Palette.white} />
            </View>
          ) : photo.state === 'failed' ? (
            <View style={[styles.badge, styles.failed]}>
              <Ionicons name="alert" size={12} color={Palette.white} />
            </View>
          ) : !disabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              hitSlop={Spacing.one}
              onPress={() => onRemove(index)}
              style={[styles.badge, styles.remove]}>
              <Ionicons name="close" size={12} color={Palette.white} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {canAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          disabled={adding}
          onPress={onAdd}
          style={({ pressed }) => [styles.cell, cellSize, styles.add, pressed && styles.pressed]}>
          {adding ? (
            <ActivityIndicator color={Palette.coral} />
          ) : (
            <>
              <Ionicons name="images-outline" size={20} color={Palette.coral} />
              <AppText variant="caption" style={styles.addText}>
                {photos.length === 0 ? 'Add photos' : 'Add more'}
              </AppText>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const GAP = 6;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    borderRadius: Radii.medium / 2,
    overflow: 'hidden',
    backgroundColor: Palette.peach,
  },
  image: { width: '100%', height: '100%' },
  cover: {
    position: 'absolute',
    left: Spacing.one,
    bottom: Spacing.one,
    paddingHorizontal: Spacing.one + 2,
    borderRadius: Radii.pill,
    backgroundColor: Palette.coral,
  },
  coverText: { color: Palette.white },
  badge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 18,
    height: 18,
    borderRadius: Radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: { backgroundColor: `${Palette.black}8C` },
  uploaded: { backgroundColor: Palette.teal },
  failed: { backgroundColor: Palette.coral },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.coral,
  },
  addText: { color: Palette.coral },
  pressed: { opacity: 0.7 },
});
