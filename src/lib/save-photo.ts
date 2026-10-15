import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

/**
 * Downloads a check-in photo and adds it to the camera roll. Asks only for
 * permission to add photos (never to read the library).
 */
export async function savePhotoToLibrary(url: string): Promise<'saved' | 'denied'> {
  const { status } = await requestPermissionsAsync(true);
  if (status !== 'granted') return 'denied';

  const file = await File.downloadFileAsync(url, new File(Paths.cache, `sigamos-${Date.now()}.jpg`));
  try {
    await Asset.create(file.uri);
  } finally {
    if (file.exists) file.delete();
  }
  return 'saved';
}
