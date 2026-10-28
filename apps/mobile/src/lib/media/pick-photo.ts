// Picks one photo from the camera or library. Run it through preparePhoto
// before uploading.
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = {
  uri: string;
  width: number;
  height: number;
};

export type PickPhotoResult =
  | { status: 'picked'; photo: PickedPhoto }
  | { status: 'canceled' }
  | { status: 'denied' };

export type PickPhotoOptions = {
  // Let the user crop to a square, for avatars. preparePhoto({ square }) also
  // crops, since the picker can't always enforce it.
  square?: boolean;
};

function pickerOptions({ square = false }: PickPhotoOptions): ImagePicker.ImagePickerOptions {
  return {
    mediaTypes: ['images'], // video is MEDIA-2 (#53)
    quality: 1, // compressed in preparePhoto
    ...(square && { allowsEditing: true, aspect: [1, 1] as [number, number] }),
  };
}

export async function takePhoto(options: PickPhotoOptions = {}): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchCameraAsync(pickerOptions(options)));
}

export async function choosePhoto(options: PickPhotoOptions = {}): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchImageLibraryAsync(pickerOptions(options)));
}

function toResult(result: ImagePicker.ImagePickerResult): PickPhotoResult {
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'canceled' };
  return {
    status: 'picked',
    photo: { uri: asset.uri, width: asset.width, height: asset.height },
  };
}
