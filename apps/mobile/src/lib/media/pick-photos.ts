// Multi-select version of pick-photo.ts for the post composer.
// STAND-IN for MEDIA-1 (#38): use its upload hook once it lands.
import * as ImagePicker from 'expo-image-picker';

import type { PickedPhoto } from '@/lib/media/pick-photo';

export type PickPhotosResult =
  | { status: 'picked'; photos: PickedPhoto[] }
  | { status: 'canceled' }
  | { status: 'denied' };

// limit: how many more photos the post can take
export async function choosePhotos(limit: number): Promise<PickPhotosResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], // video is MEDIA-2 (#53)
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 1, // compressed in preparePhoto
  });
  if (result.canceled || result.assets.length === 0) return { status: 'canceled' };

  return {
    status: 'picked',
    photos: result.assets
      .slice(0, limit)
      .map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height })),
  };
}
