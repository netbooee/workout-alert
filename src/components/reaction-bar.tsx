import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useToggleReaction } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import type { ReactionKind } from '@/lib/database.types';

export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'fire', emoji: '🔥', label: 'Fire' },
  { kind: 'strong', emoji: '💪', label: 'Strong' },
  { kind: 'clap', emoji: '👏', label: 'Clap' },
  { kind: 'verified', emoji: '✅', label: 'Verified' },
];

export function ReactionBar({
  workoutId,
  ownerId,
  reactions,
}: {
  workoutId: string;
  ownerId: string;
  reactions: { kind: ReactionKind; user_id: string }[];
}) {
  const me = useAuth().session?.user.id;
  const toggle = useToggleReaction();
  const isOwner = ownerId === me;
  const verified = reactions.some((x) => x.kind === 'verified');
  // Owners can't verify themselves; they only see the badge once a partner has.
  const shown = REACTIONS.filter((r) => !(isOwner && r.kind === 'verified' && !verified));

  return (
    <View style={styles.row}>
      {shown.map(
        (r) => {
          const count = reactions.filter((x) => x.kind === r.kind).length;
          const mine = reactions.some((x) => x.kind === r.kind && x.user_id === me);
          const disabled = isOwner && r.kind === 'verified';
          return (
            <Pressable
              key={r.kind}
              disabled={disabled || toggle.isPending}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggle.mutate({ workoutId, kind: r.kind, on: !mine });
              }}
              style={[styles.chip, mine && styles.chipMine, r.kind === 'verified' && count > 0 && styles.chipVerified]}>
              <AppText variant="body">{r.emoji}</AppText>
              {r.kind === 'verified' && (
                <AppText variant="caption" color={count ? Colors.success : Colors.textSecondary}>
                  {count ? 'Verified' : 'Verify'}
                </AppText>
              )}
              {count > 0 && r.kind !== 'verified' && (
                <AppText variant="caption" color={Colors.text}>
                  {count}
                </AppText>
              )}
            </Pressable>
          );
        },
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cardRaised,
  },
  chipMine: { backgroundColor: Colors.flameSoft, borderWidth: 1, borderColor: Colors.flame },
  chipVerified: { backgroundColor: 'rgba(52, 211, 153, 0.14)' },
});
