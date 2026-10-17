// STAND-IN: MEDIA-1 (#38) ships the app's compress step. Switch to it and
// delete this file once it lands.
//
// Resizes and compresses a photo before upload, per DOC-1 (#33): longest edge
// at most 2,048 px, saved as JPEG at about 80% quality.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PickedPhoto } from '@/lib/media/pick-photo';

export const MAX_PHOTO_EDGE = 2048;
const JPEG_QUALITY = 0.8;

export async function preparePhoto(photo: PickedPhoto): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > MAX_PHOTO_EDGE) {
    context.resize(
      photo.width >= photo.height ? { width: MAX_PHOTO_EDGE } : { height: MAX_PHOTO_EDGE },
    );
  }

  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: result.uri, width: result.width, height: result.height };
}
