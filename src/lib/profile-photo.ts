// Profile photos: pick or take a photo, crop it square, shrink it, and store it
// in the private `avatars` bucket under <user id>/avatar-<timestamp>.jpg. The
// path is saved in profiles.avatar_url; you and the people you're connected
// with read it through short-lived signed URLs.

import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export const AVATAR_BUCKET = 'avatars';
const EDGE = 512;
/** Signed links last a week; refetch well before, so a shown link never expires. */
const LINK_SECONDS = 7 * 24 * 3600;

/** Returns a square local JPEG, or null if cancelled. Throws if the camera is off. */
export async function pickProfilePhoto(from: 'camera' | 'library'): Promise<string | null> {
  if (from === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Camera access is off. You can turn it on in Settings.');
  }
  // iOS shows its own square crop after picking.
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  // In case the crop wasn't exactly square, take the centered square.
  const side = Math.min(asset.width, asset.height);
  if (asset.width !== asset.height) {
    context.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side });
  }
  if (side > EDGE) context.resize({ width: EDGE, height: EDGE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}

/** Uploads a new photo and returns its path. A new name each time, so caches never show the old one. */
export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const body = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Best effort: an old photo left behind is harmless, so failures are only logged. */
export async function removeProfilePhotoFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.warn('Could not remove the old profile photo', error);
}

/** A signed link for a profile photo path, or undefined while loading or without a photo. */
export function useProfilePhotoUrl(path: string | null | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: ['avatar-url', path],
    enabled: !!path,
    staleTime: LINK_SECONDS * 1000 - 24 * 3600 * 1000,
    gcTime: 24 * 3600 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path!, LINK_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return data;
}
