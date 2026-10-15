import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import type { WorkoutComment } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Voice messages share the private `evidence` bucket with check-in photos,
// under <author id>/comments/<workout id>/ so the same partner-only storage
// policies apply.
const BUCKET = 'evidence';

const key = (workoutId: string) => ['social', 'comments', workoutId];

/** Comments you can see on a workout, oldest first. */
export function useComments(workoutId: string) {
  return useQuery({
    queryKey: key(workoutId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_comments')
        .select('*')
        .eq('workout_id', workoutId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export interface NewComment {
  body?: string;
  voice?: { uri: string; durationMs: number };
}

export function useAddComment(workoutId: string) {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async ({ body, voice }: NewComment) => {
      if (!userId) throw new Error('Not signed in');
      let audioPath: string | null = null;
      if (voice) {
        audioPath = `${userId}/comments/${workoutId}/${Date.now()}.m4a`;
        const file = await fetch(voice.uri).then((r) => r.arrayBuffer());
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(audioPath, file, { contentType: 'audio/mp4', upsert: false });
        if (error) throw error;
      }
      const { error } = await supabase.from('workout_comments').insert({
        workout_id: workoutId,
        body: body?.trim() || null,
        audio_path: audioPath,
        audio_duration_ms: voice ? Math.round(voice.durationMs) : null,
      });
      if (error) {
        if (audioPath) await supabase.storage.from(BUCKET).remove([audioPath]);
        throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(workoutId) }),
  });
}

export function useDeleteComment(workoutId: string) {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async (comment: WorkoutComment) => {
      const { error } = await supabase.from('workout_comments').delete().eq('id', comment.id);
      if (error) throw error;
      // Storage only lets authors delete their own files. A workout owner
      // clearing someone else's voice message leaves the file for the author.
      if (comment.audio_path && comment.user_id === userId) {
        await supabase.storage.from(BUCKET).remove([comment.audio_path]);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(workoutId) }),
  });
}
