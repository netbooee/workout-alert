// Photo evidence (shown to people as "check-ins"): pick or take a photo, shrink it, and store it in the
// private `evidence` bucket under <user id>/<workout id>/. Partners read it
// through short-lived signed URLs.

import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { Workout } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

const BUCKET = 'evidence';
const MAX_EDGE = 1600;
export const MAX_PHOTOS = 4;

/** Returns a local image URI, or null if the user cancelled or denied access. */
export async function pickPhoto(from: 'camera' | 'library'): Promise<string | null> {
  if (from === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Camera access is off. You can turn it on in Settings.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  return saved.uri;
}

async function upload(userId: string, workoutId: string, uri: string): Promise<string> {
  const path = `${userId}/${workoutId}/${Date.now()}.jpg`;
  const body = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Uploads photos and appends them to the workout. Returns the updated row. */
export async function addEvidencePhotos(workout: Workout, uris: string[]): Promise<Workout> {
  const room = MAX_PHOTOS - workout.photo_paths.length;
  if (room <= 0) throw new Error(`A workout can have up to ${MAX_PHOTOS} photos.`);
  const paths = await Promise.all(uris.slice(0, room).map((u) => upload(workout.user_id, workout.id, u)));
  const { data, error } = await supabase
    .from('workouts')
    .update({ photo_paths: [...workout.photo_paths, ...paths] })
    .eq('id', workout.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeEvidencePhoto(workout: Workout, path: string): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .update({ photo_paths: workout.photo_paths.filter((p) => p !== path) })
    .eq('id', workout.id)
    .select()
    .single();
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([path]);
  return data;
}

/** Signed URLs for evidence photos, valid for an hour. */
export function useEvidenceUrls(paths: string[]) {
  return useQuery({
    queryKey: ['evidence-urls', ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      return Object.fromEntries(data.map((d) => [d.path, d.signedUrl]));
    },
  });
}
