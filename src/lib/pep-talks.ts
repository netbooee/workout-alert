// Pep talks: a photo or a short video (up to 30 seconds) a partner takes in
// the app and sends you to get you moving. Files live in the private
// `pep-talks` bucket under <sender id>/; only the sender and the recipient can
// open them, through short-lived signed URLs.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/lib/auth';
import type { PepTalk } from '@/lib/database.types';
import { playSound } from '@/lib/sounds';
import { supabase } from '@/lib/supabase';

export const PEP_TALK_BUCKET = 'pep-talks';
export const PEP_TALK_MAX_SECONDS = 30;
export const PEP_TALK_MESSAGE_MAX = 140;
/** Unseen pep talks older than this don't get a Home banner. */
const BANNER_DAYS = 7;
const MAX_EDGE = 1600;

export interface Capture {
  kind: 'photo' | 'video';
  uri: string;
  /** For videos: 'mp4' or 'mov', from the recorded file. */
  ext: 'jpg' | 'mp4' | 'mov';
}

/**
 * Takes a photo or records a video with the camera. Only the camera, so pep
 * talks are made for the moment. Development builds also offer the library,
 * since the iOS Simulator has no camera.
 */
export async function capturePepTalk(
  kind: 'photo' | 'video',
  from: 'camera' | 'library' = 'camera',
): Promise<Capture | null> {
  if (from === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Camera access is off. You can turn it on in Settings.');
  }
  const options: ImagePicker.ImagePickerOptions =
    kind === 'photo'
      ? { mediaTypes: ['images'], quality: 1 }
      : {
          mediaTypes: ['videos'],
          videoMaxDuration: PEP_TALK_MAX_SECONDS,
          // Medium keeps 30 seconds to a few megabytes.
          videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        };
  const result =
    from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  if (kind === 'video') {
    if (asset.duration != null && asset.duration > (PEP_TALK_MAX_SECONDS + 1) * 1000) {
      throw new Error(`Pep talk videos can be up to ${PEP_TALK_MAX_SECONDS} seconds.`);
    }
    const ext = /\.mp4$/i.test(asset.uri) || asset.mimeType === 'video/mp4' ? 'mp4' : 'mov';
    return { kind, uri: asset.uri, ext };
  }

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { kind, uri: saved.uri, ext: 'jpg' };
}

const CONTENT_TYPE = { jpg: 'image/jpeg', mp4: 'video/mp4', mov: 'video/quicktime' } as const;

export function useSendPepTalk() {
  const userId = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ to, capture, message }: { to: string; capture: Capture; message: string }) => {
      const path = `${userId}/pep-${Date.now()}.${capture.ext}`;
      const body = await fetch(capture.uri).then((r) => r.arrayBuffer());
      const upload = await supabase.storage
        .from(PEP_TALK_BUCKET)
        .upload(path, body, { contentType: CONTENT_TYPE[capture.ext], upsert: false });
      if (upload.error) throw upload.error;
      const { data, error } = await supabase.rpc('send_pep_talk', {
        p_partner: to,
        p_kind: capture.kind,
        p_path: path,
        p_message: message.trim() || null,
      });
      if (error) {
        // Not sent, so don't leave the file behind.
        await supabase.storage.from(PEP_TALK_BUCKET).remove([path]);
        throw error;
      }
      playSound('burst');
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pep-talks'] }),
  });
}

/** Pep talks sent to you in the last week that you haven't opened, newest first. */
export function useNewPepTalks() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['pep-talks', 'new', userId],
    enabled: !!userId,
    queryFn: async (): Promise<PepTalk[]> => {
      const since = new Date(Date.now() - BANNER_DAYS * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('pep_talks')
        .select('*')
        .eq('to_id', userId!)
        .is('seen_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePepTalk(id: string) {
  return useQuery({
    queryKey: ['pep-talks', 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<PepTalk | null> => {
      const { data, error } = await supabase.from('pep_talks').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkPepTalksSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('mark_pep_talks_seen', { p_ids: ids });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pep-talks', 'new'] }),
  });
}

/** A signed link to a pep talk's photo or video. */
export function usePepTalkMediaUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['pep-talks', 'url', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(PEP_TALK_BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
