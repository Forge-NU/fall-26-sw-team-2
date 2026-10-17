// STAND-IN: MEDIA-1 (#38) ships the app's reusable pick → compress → upload
// hook. Switch to it and delete this file once it lands.
//
// Take or pick one photo.
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

const options: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1, // compressed once, in preparePhoto
};

export async function takePhoto(): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchCameraAsync(options));
}

export async function choosePhoto(): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchImageLibraryAsync(options));
}

function toResult(result: ImagePicker.ImagePickerResult): PickPhotoResult {
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'canceled' };
  return {
    status: 'picked',
    photo: { uri: asset.uri, width: asset.width, height: asset.height },
  };
}
