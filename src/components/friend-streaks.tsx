import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { usePartners, useRemovePartner, type PartnerState } from '@/hooks/use-social';
import { friendlyError } from '@/lib/errors';

/** Keep a few open "Invite a friend" rows so there's always a next person to add. */
const MIN_ROWS = 4;

/**
 * Friend streaks, Duolingo style: one row per partner with the weeks you've
 * both hit your goals, open slots to invite someone, and an Edit mode for
 * removing a partner (instead of a hidden long-press).
 */
export function FriendStreaks() {
  const { data } = usePartners();
  const remove = useRemovePartner();
  const [editing, setEditing] = useState(false);
  const partners = (data ?? [])
    .filter((p) => p.status === 'accepted')
    .sort((a, b) => b.friend_streak - a.friend_streak);
  const openSlots = Math.max(MIN_ROWS - partners.length, 1);

  const confirmRemove = (p: PartnerState) =>
    Alert.alert(
      `Remove ${p.display_name ?? 'partner'}?`,
      `You’ll stop seeing each other’s workouts, and your ${p.friend_streak}-week friend streak ends.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            remove.mutate(p.partnership_id, {
              onError: (e) => Alert.alert('Couldn’t remove', friendlyError(e)),
            }),
        },
      ],
    );

  return (
    <View style={{ gap: Spacing.md }}>
      <AppText variant="body" color={Colors.textSecondary}>
        A friend streak counts the weeks in a row that you and a partner both hit your goals.
      </AppText>

      <Card style={styles.list}>
        <View style={styles.header}>
          <AppText variant="label">Friend streaks</AppText>
          {partners.length > 0 && (
            <Pressable onPress={() => setEditing((e) => !e)} hitSlop={12} accessibilityRole="button">
              <AppText variant="heading" color={Colors.flame}>
                {editing ? 'Done' : 'Edit'}
              </AppText>
            </Pressable>
          )}
        </View>

        {partners.map((p) => (
          <View key={p.partnership_id} style={styles.row}>
            <Avatar id={p.partner_id} name={p.display_name} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{p.display_name ?? 'Partner'}</AppText>
              <AppText variant="caption" color={p.friend_streak ? Colors.flame : Colors.textSecondary}>
                {p.friend_streak
                  ? `🔥 ${p.friend_streak} week${p.friend_streak === 1 ? '' : 's'} together`
                  : 'Hit your goals this week to start one'}
              </AppText>
            </View>
            {editing ? (
              <Pressable
                onPress={() => confirmRemove(p)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.display_name ?? 'partner'}`}>
                <SymbolView name="minus.circle.fill" size={26} tintColor={Colors.danger} />
              </Pressable>
            ) : (
              <AppText variant="title" color={p.friend_streak ? Colors.flame : Colors.textMuted}>
                {p.friend_streak}
              </AppText>
            )}
          </View>
        ))}

        {!editing &&
          Array.from({ length: openSlots }, (_, n) => (
            <Pressable
              key={`invite-${n}`}
              onPress={() => router.push('/add-partner')}
              accessibilityRole="button"
              style={styles.row}>
              <View style={styles.inviteIcon}>
                <SymbolView name="plus" size={18} tintColor={Colors.textMuted} />
              </View>
              <AppText variant="body" color={Colors.textMuted}>
                Invite a friend
              </AppText>
            </Pressable>
          ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 48 },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
