import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useNudge, useRemovePartner, type PartnerState } from '@/hooks/use-social';

export function PartnerCard({ partner }: { partner: PartnerState }) {
  const nudge = useNudge();
  const remove = useRemovePartner();
  const done = partner.this_week_days >= partner.this_week_goal;
  const recentlyNudged = partner.recently_nudged;

  const confirmRemove = () =>
    Alert.alert(`Remove ${partner.display_name ?? 'partner'}?`, 'You will stop seeing each other’s workouts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(partner.partnership_id) },
    ]);

  return (
    <Card>
      <Pressable onLongPress={confirmRemove} style={styles.row}>
        <Avatar id={partner.partner_id} name={partner.display_name} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{partner.display_name ?? 'Partner'}</AppText>
          <View style={styles.stats}>
            <Stat icon="flame.fill" color={Colors.flame} text={`${partner.current_weeks} wk`} />
            <Stat
              icon={done ? 'checkmark.circle.fill' : 'circle.dashed'}
              color={done ? Colors.success : Colors.textSecondary}
              text={`${partner.this_week_days}/${partner.this_week_goal} this week`}
            />
          </View>
        </View>
        <View style={styles.friendStreak}>
          <AppText variant="title" color={partner.friend_streak ? Colors.xp : Colors.textMuted} style={{ fontSize: 22 }}>
            {partner.friend_streak}
          </AppText>
          <AppText variant="caption" style={{ fontSize: 10 }}>
            together
          </AppText>
        </View>
      </Pressable>
      {!done && (
        <Pressable
          disabled={recentlyNudged || nudge.isPending}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            nudge.mutate(partner.partner_id, {
              onError: (e) => Alert.alert('Could not nudge', e instanceof Error ? e.message : String(e)),
            });
          }}
          style={[styles.nudge, recentlyNudged && { opacity: 0.5 }]}>
          <AppText variant="caption" color={Colors.text}>
            {recentlyNudged ? 'Nudged 👋' : `👋 Nudge ${partner.display_name?.split(' ')[0] ?? ''}`}
          </AppText>
        </Pressable>
      )}
    </Card>
  );
}

function Stat({ icon, color, text }: { icon: 'flame.fill' | 'checkmark.circle.fill' | 'circle.dashed'; color: string; text: string }) {
  return (
    <View style={styles.stat}>
      <SymbolView name={icon} size={13} tintColor={color} />
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stats: { flexDirection: 'row', gap: Spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  friendStreak: {
    alignItems: 'center',
    minWidth: 56,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.xpSoft,
  },
  nudge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.cardRaised,
  },
});
