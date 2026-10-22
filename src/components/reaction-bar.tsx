import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useToggleReaction } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { CHEER_KINDS } from '@/lib/cheers';
import type { ReactionKind } from '@/lib/database.types';

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
  const isOwner = ownerId === me;
  const myCheer = reactions.find((r) => r.user_id === me && CHEER_KINDS.includes(r.kind));
  const iVerified = reactions.some((r) => r.user_id === me && r.kind === 'verified');
  const verified = reactions.some((r) => r.kind === 'verified');
  const cheers = CHEER_KINDS.map((kind) => ({ kind, count: reactions.filter((r) => r.kind === kind).length })).filter(
    (c) => c.count > 0,
  );

  const fail = (e: unknown) => Alert.alert('Could not save', e instanceof Error ? e.message : String(e));

  const cheer = async (kind: ReactionKind = 'clap') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (myCheer) await toggle.mutateAsync({ workoutId, kind: myCheer.kind, on: false });
      // Tapping your own cheer again takes it back; picking another emoji swaps it.
      if (!myCheer || myCheer.kind !== kind) await toggle.mutateAsync({ workoutId, kind, on: true });
    } catch (e) {
      fail(e);
    }
  };

  const pickCheer = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Cheer with', options: ['👏 Clap', '🔥 Fire', '💪 Strong', 'Cancel'], cancelButtonIndex: 3 },
      (i) => {
        if (i < 3) cheer((['clap', 'fire', 'strong'] as const)[i]);
      },
    );

  const verify = async () => {
    const on = !iVerified;
    const save = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toggle.mutate({ workoutId, kind: 'verified', on }, { onError: fail });
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
      <View style={styles.row}>
        <Pressable
          onPress={() => cheer(myCheer?.kind)}
          onLongPress={pickCheer}
          disabled={toggle.isPending}
          accessibilityRole="button"
          accessibilityHint="Hold to pick a different emoji"
          style={[styles.button, compact && styles.compact, myCheer && styles.buttonOn]}>
          <AppText variant="heading" style={compact && styles.compactText}>
            {myCheer ? `${emojiOf(myCheer.kind)} Cheered` : '👏 Cheer'}
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
