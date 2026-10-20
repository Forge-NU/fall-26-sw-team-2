// Longest edge 2048px, JPEG at 80%, per DOC-1 (#33). Every photo goes through
// this before upload: the server only accepts JPEG, and library photos are
// often HEIC or PNG.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PickedPhoto } from '@/lib/media/pick-photo';

export const MAX_PHOTO_EDGE = 2048;
const JPEG_QUALITY = 0.8;

export type PreparePhotoOptions = {
  // Center-crop to a square, for avatars
  square?: boolean;
};

export async function preparePhoto(
  photo: PickedPhoto,
  { square = false }: PreparePhotoOptions = {},
): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(photo.uri);
  let width = photo.width;
  let height = photo.height;

  if (square && width > 0 && height > 0 && width !== height) {
    const side = Math.min(width, height);
    context.crop({
      originX: Math.floor((width - side) / 2),
      originY: Math.floor((height - side) / 2),
      width: side,
      height: side,
    });
    width = side;
    height = side;
  }

  if (Math.max(width, height) > MAX_PHOTO_EDGE) {
    context.resize(width >= height ? { width: MAX_PHOTO_EDGE } : { height: MAX_PHOTO_EDGE });
  }

  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: result.uri, width: result.width, height: result.height };
}
