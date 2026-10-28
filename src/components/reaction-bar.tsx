import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { CheerPicker } from '@/components/cheer-picker';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSetCheer, useToggleReaction } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { CHEER_KINDS } from '@/lib/cheers';
import type { ReactionKind } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import { playSound } from '@/lib/sounds';

export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'clap', emoji: '👏', label: 'Clap' },
  { kind: 'fire', emoji: '🔥', label: 'Fire' },
  { kind: 'strong', emoji: '💪', label: 'Strong' },
  { kind: 'verified', emoji: '✅', label: 'Verified' },
];
const emojiOf = (kind: ReactionKind) => REACTIONS.find((r) => r.kind === kind)?.emoji ?? '👏';

const VERIFY_EXPLAINED_KEY = 'verify-explained';

/**
 * One clear way to acknowledge a partner's workout: **Cheer** (👏, or hold to
 * pick 🔥 or 💪) and **Verify** (you saw them do it). The owner sees what
 * came in instead of buttons.
 */
export function ReactionBar({
  workoutId,
  ownerId,
  reactions,
  compact = false,
}: {
  workoutId: string;
  ownerId: string;
  reactions: { kind: ReactionKind; user_id: string }[];
  /** Smaller buttons, for lists. */
  compact?: boolean;
}) {
  const me = useAuth().session?.user.id;
  const toggle = useToggleReaction();
  const setCheer = useSetCheer();
  const isOwner = ownerId === me;
  const [picking, setPicking] = useState(false);

  // What's saved, from the server.
  const savedCheer = reactions.find((r) => r.user_id === me && CHEER_KINDS.includes(r.kind))?.kind ?? null;
  const savedVerified = reactions.some((r) => r.user_id === me && r.kind === 'verified');
  // Taps show right away. Each one remembers what was saved when it was made,
  // and stops applying once the saved value changes (the refresh caught up);
  // if a refresh fails, the tap still shows instead of snapping back.
  const [tapped, setTapped] = useState<{
    cheer?: { value: ReactionKind | null; base: ReactionKind | null };
    verified?: { value: boolean; base: boolean };
  }>({});
  const myCheerKind = tapped.cheer && tapped.cheer.base === savedCheer ? tapped.cheer.value : savedCheer;
  const iVerified = tapped.verified && tapped.verified.base === savedVerified ? tapped.verified.value : savedVerified;
  const verified = reactions.some((r) => r.kind === 'verified');
  const cheers = CHEER_KINDS.map((kind) => ({ kind, count: reactions.filter((r) => r.kind === kind).length })).filter(
    (c) => c.count > 0,
  );

  const fail = (e: unknown) => Alert.alert('Couldn’t save', friendlyError(e));

  const cheer = (kind: ReactionKind = 'clap') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Tapping your own cheer again takes it back; picking another emoji swaps it.
    const next = myCheerKind === kind ? null : kind;
    if (next) playSound('pop');
    setTapped((t) => ({ ...t, cheer: { value: next, base: savedCheer } }));
    const undo = (e: unknown) => {
      setTapped((t) => ({ ...t, cheer: undefined }));
      fail(e);
    };
    if (next) setCheer.mutate({ workoutId, kind: next }, { onError: undo });
    else if (myCheerKind) toggle.mutate({ workoutId, kind: myCheerKind, on: false }, { onError: undo });
  };


  const verify = async () => {
    const on = !iVerified;
    const save = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (on) playSound('xp');
      setTapped((t) => ({ ...t, verified: { value: on, base: savedVerified } }));
      toggle.mutate(
        { workoutId, kind: 'verified', on },
        {
          onError: (e) => {
            setTapped((t) => ({ ...t, verified: undefined }));
            fail(e);
          },
        },
      );
    };
    if (!on) return save();
    // Explain what verifying means the first time someone does it.
    const explained = await AsyncStorage.getItem(VERIFY_EXPLAINED_KEY).catch(() => '1');
    if (explained) return save();
    Alert.alert(
      'Verify this workout?',
      'Verify means you saw them do it, or you trust the photo. It counts toward "verified only" challenges, and you both get a little XP.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: () => {
            AsyncStorage.setItem(VERIFY_EXPLAINED_KEY, '1').catch(() => {});
            save();
          },
        },
      ],
    );
  };

  const summary = [
    ...cheers.map((c) => `${emojiOf(c.kind)} ${c.count}`),
    ...(verified ? ['✅ Verified'] : []),
  ].join('  ');

  if (isOwner) {
    return (
      <AppText variant="caption" color={summary ? Colors.text : Colors.textMuted}>
        {summary || 'No cheers yet'}
      </AppText>
    );
  }

  return (
    <View style={{ gap: Spacing.xs }}>
      <CheerPicker
        visible={picking}
        title="Cheer with"
        onPick={(kind) => cheer(kind)}
        onClose={() => setPicking(false)}
      />
      <View style={styles.row}>
        <Pressable
          onPress={() => cheer(myCheerKind ?? 'clap')}
          onLongPress={() => setPicking(true)}
          disabled={toggle.isPending || setCheer.isPending}
          accessibilityRole="button"
          accessibilityHint="Hold to pick a different emoji"
          style={[styles.button, compact && styles.compact, !!myCheerKind && styles.buttonOn]}>
          <AppText variant="heading" style={compact && styles.compactText}>
            {myCheerKind ? `${emojiOf(myCheerKind)} Cheered` : '👏 Cheer'}
          </AppText>
        </Pressable>
        <Pressable
          onPress={verify}
          disabled={toggle.isPending}
          accessibilityRole="button"
          style={[styles.button, compact && styles.compact, iVerified && styles.verifiedOn]}>
          <AppText
            variant="heading"
            color={iVerified ? Colors.success : Colors.text}
            style={compact && styles.compactText}>
            {iVerified ? '✅ Verified' : '✅ Verify'}
          </AppText>
        </Pressable>
      </View>
      {!compact && summary ? <AppText variant="caption">{summary}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
  },
  compact: { minHeight: 36 },
  compactText: { fontSize: 15 },
  buttonOn: { backgroundColor: Colors.flameSoft, borderWidth: 1, borderColor: Colors.flame },
  verifiedOn: { backgroundColor: 'rgba(52, 211, 153, 0.14)', borderWidth: 1, borderColor: Colors.success },
});
