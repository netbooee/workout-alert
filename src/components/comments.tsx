import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText, Card } from '@/components/ui';
import { VoiceMessage } from '@/components/voice-message';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAddComment, useComments, useDeleteComment } from '@/hooks/use-comments';
import { useNames } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import type { Workout, WorkoutComment } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import { useEvidenceUrls } from '@/lib/evidence';
import { noteVoiceAudioMode } from '@/lib/sounds';
import { timeAgo } from '@/lib/time-ago';
import { formatClip, MAX_VOICE_SECONDS, MIN_VOICE_MS } from '@/lib/voice';

// Speech doesn't need music quality: mono AAC at 64 kbps is ~240 KB for 30 s.
const VOICE_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

/** Comments and voice messages on a workout, with a composer at the bottom. */
export function Comments({ workout }: { workout: Workout }) {
  const me = useAuth().session?.user.id;
  const nameOf = useNames();
  const { data: comments } = useComments(workout.id);
  const audioPaths = (comments ?? []).flatMap((c) => (c.audio_path ? [c.audio_path] : []));
  const { data: urls } = useEvidenceUrls(audioPaths);
  const remove = useDeleteComment(workout.id);
  const isOwner = workout.user_id === me;

  const confirmDelete = (comment: WorkoutComment) =>
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(comment, {
            onError: (e) => Alert.alert('Couldn’t delete', friendlyError(e)),
          }),
      },
    ]);

  return (
    <Card>
      <AppText variant="label">{comments?.length ? `Comments · ${comments.length}` : 'Comments'}</AppText>
      {comments?.length === 0 && (
        <AppText variant="caption">
          {isOwner
            ? 'Your partners’ comments and voice messages show up here.'
            : 'Be the first to cheer them on. Type a message or tap the mic for a quick voice note.'}
        </AppText>
      )}
      {comments?.map((c) => {
        const canDelete = c.user_id === me || isOwner;
        return (
          <Pressable
            key={c.id}
            onLongPress={canDelete ? () => confirmDelete(c) : undefined}
            style={styles.comment}>
            <Avatar id={c.user_id} name={nameOf(c.user_id)} size={30} />
            <View style={styles.commentBody}>
              <View style={styles.commentHeader}>
                <AppText variant="heading" style={{ fontSize: 15 }}>
                  {nameOf(c.user_id)}
                </AppText>
                <AppText variant="caption" style={{ fontSize: 12 }}>
                  {timeAgo(new Date(c.created_at))}
                </AppText>
              </View>
              {c.body && <AppText variant="body">{c.body}</AppText>}
              {c.audio_path && c.audio_duration_ms && (
                <VoiceMessage url={urls?.[c.audio_path]} durationMs={c.audio_duration_ms} />
              )}
            </View>
          </Pressable>
        );
      })}
      <Composer workoutId={workout.id} isOwner={isOwner} />
    </Card>
  );
}

type Phase = 'idle' | 'recording' | 'review';

function Composer({ workoutId, isOwner }: { workoutId: string; isOwner: boolean }) {
  const add = useAddComment(workoutId);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [clip, setClip] = useState<{ uri: string; durationMs: number } | null>(null);
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);
  const lastDuration = useRef(0);
  const { isRecording, durationMillis } = recorderState;
  useEffect(() => {
    if (isRecording) lastDuration.current = durationMillis;
  }, [isRecording, durationMillis]);

  const finishRecording = async () => {
    const durationMs = Math.min(lastDuration.current, MAX_VOICE_SECONDS * 1000);
    if (recorder.isRecording) await recorder.stop();
    // Leave record mode so playback comes out of the speaker, not the earpiece.
    await setAudioModeAsync({ allowsRecording: false });
    if (!recorder.uri || durationMs < MIN_VOICE_MS) {
      setPhase('idle');
      return;
    }
    setClip({ uri: recorder.uri, durationMs });
    setPhase('review');
  };

  // `forDuration` stops the recorder at the cap; move on to review when it does.
  useEffect(() => {
    if (phase === 'recording' && !isRecording && lastDuration.current > 0) finishRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isRecording]);

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Microphone is off', 'Turn on microphone access for Sigamos in Settings to send voice messages.');
      return;
    }
    noteVoiceAudioMode();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    lastDuration.current = 0;
    recorder.record({ forDuration: MAX_VOICE_SECONDS });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('recording');
  };

  const send = () => {
    const body = text.trim();
    if (!body && !clip) return;
    add.mutate(
      { body: body || undefined, voice: clip ?? undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setText('');
          setClip(null);
          setPhase('idle');
        },
        onError: (e) => Alert.alert('Couldn’t send', friendlyError(e)),
      },
    );
  };

  const canSend = (text.trim().length > 0 || clip) && !add.isPending;

  return (
    <View style={styles.composer}>
      {phase === 'recording' ? (
        <View style={styles.recording}>
          <View style={styles.recordingDot} />
          <AppText variant="body" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
            Recording {formatClip(recorderState.durationMillis)} / {formatClip(MAX_VOICE_SECONDS * 1000)}
          </AppText>
          <Pressable onPress={finishRecording} hitSlop={8} accessibilityLabel="Stop recording">
            <SymbolView name="stop.circle.fill" size={34} tintColor={Colors.danger} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={isOwner ? 'Reply to your partners…' : 'Say something encouraging…'}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            value={text}
            onChangeText={setText}
          />
          {canSend || phase === 'review' ? (
            <Pressable onPress={send} disabled={!canSend} hitSlop={8} accessibilityLabel="Send">
              {add.isPending ? (
                <ActivityIndicator color={Colors.flame} style={{ width: 34 }} />
              ) : (
                <SymbolView name="arrow.up.circle.fill" size={34} tintColor={Colors.flame} />
              )}
            </Pressable>
          ) : (
            <Pressable onPress={startRecording} hitSlop={8} accessibilityLabel="Record a voice message">
              <SymbolView name="mic.circle.fill" size={34} tintColor={Colors.flame} />
            </Pressable>
          )}
        </View>
      )}
      {phase === 'review' && clip && (
        <View style={styles.review}>
          <View style={{ flex: 1 }}>
            <VoiceMessage url={clip.uri} durationMs={clip.durationMs} />
          </View>
          <Pressable
            onPress={() => {
              setClip(null);
              setPhase('idle');
            }}
            hitSlop={8}
            accessibilityLabel="Discard voice message">
            <SymbolView name="trash" size={20} tintColor={Colors.textSecondary} />
          </Pressable>
        </View>
      )}
      {phase === 'idle' && !text && (
        <AppText variant="caption" style={{ fontSize: 12 }}>
          Tap the mic for a voice message (up to {MAX_VOICE_SECONDS} seconds).
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  comment: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.xs },
  commentBody: { flex: 1, gap: 4 },
  commentHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  composer: { gap: Spacing.sm, paddingTop: Spacing.xs },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  recording: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardRaised,
    borderRadius: Radius.md,
    paddingLeft: Spacing.md,
    paddingRight: 4,
    paddingVertical: 4,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  review: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
