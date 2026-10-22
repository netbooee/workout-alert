import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Mascot } from '@/components/mascots';
import { QuestProgress } from '@/components/quest-progress';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useNudge, useRemovePartner, type PartnerState } from '@/hooks/use-social';
import { isOpen } from '@/lib/incentives';
import { partnerMood } from '@/lib/lotl';
import { MASCOTS, mascotKind } from '@/lib/mascots';

export function PartnerCard({ partner }: { partner: PartnerState }) {
  const nudge = useNudge();
  const remove = useRemovePartner();
  const done = partner.this_week_days >= partner.this_week_goal;
  const recentlyNudged = partner.recently_nudged;
  const firstName = partner.display_name?.split(' ')[0] ?? '';
  const [now] = useState(() => new Date());
  // Their buddy, in a mood that matches their week.
  const mood = partnerMood(
    {
      weekDays: partner.this_week_days,
      weekGoal: partner.this_week_goal,
      streakWeeks: partner.current_weeks,
      resting: !!partner.resting,
    },
    now,
  );
  // Your current incentive for them: open, or earned and waiting for you to deliver.
  const { given } = useMyIncentives();
  const incentive = given.find(
    (i) => i.to_id === partner.partner_id && (isOpen(i) || i.status === 'earned'),
  );

  const confirmRemove = () =>
    Alert.alert(`Remove ${partner.display_name ?? 'partner'}?`, 'You will stop seeing each other’s workouts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(partner.partnership_id) },
    ]);

  return (
    <Card>
      <Pressable
        onPress={() => router.push({ pathname: '/partner/[id]', params: { id: partner.partner_id } })}
        onLongPress={confirmRemove}
        accessibilityRole="button"
        accessibilityHint={`Opens ${firstName}’s workouts`}
        style={styles.row}>
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
        <View accessible accessibilityLabel={`${firstName}'s buddy, ${MASCOTS[mascotKind(partner.mascot)].name}`}>
          <Mascot kind={mascotKind(partner.mascot)} mood={mood} size={40} />
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/streak', params: { tab: 'friends' } })}
          accessibilityRole="button"
          accessibilityLabel={`Friend streak with ${firstName}: ${partner.friend_streak} weeks`}
          style={styles.friendStreak}>
          <AppText variant="title" color={partner.friend_streak ? Colors.xp : Colors.textMuted} style={{ fontSize: 22 }}>
            🔥{partner.friend_streak}
          </AppText>
          <AppText variant="caption" style={{ fontSize: 10 }}>
            wk together
          </AppText>
        </Pressable>
      </Pressable>
      {incentive && (
        <Pressable
          onPress={() => router.push({ pathname: '/incentive/[id]', params: { id: incentive.id } })}
          style={[styles.incentive, incentive.status === 'earned' && styles.incentiveEarned]}>
          <View style={styles.incentiveHeader}>
            <AppText variant="caption" color={Colors.text} style={{ flex: 1 }} numberOfLines={1}>
              {incentive.reward_emoji}{' '}
              {incentive.status === 'earned'
                ? `${firstName} earned it! Tap to mark delivered`
                : incentive.status === 'offered'
                  ? `Waiting for ${firstName} to accept: ${incentive.reward}`
                  : incentive.reward}
            </AppText>
            <SymbolView name="chevron.right" size={12} tintColor={Colors.textMuted} />
          </View>
          {incentive.status === 'active' && <QuestProgress incentive={incentive} who={firstName} />}
        </Pressable>
      )}
      <View style={styles.actions}>
        {!done && (
          <Pressable
            disabled={recentlyNudged || nudge.isPending}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              nudge.mutate(partner.partner_id, {
                onError: (e) => Alert.alert('Could not nudge', e instanceof Error ? e.message : String(e)),
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={recentlyNudged ? `Nudged ${firstName}` : `Nudge ${firstName}`}
            style={[styles.action, recentlyNudged && { opacity: 0.5 }]}>
            <AppText variant="heading" style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {recentlyNudged ? 'Nudged 👋' : `👋 Nudge ${firstName}`}
            </AppText>
          </Pressable>
        )}
        {!incentive && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: '/incentive/new', params: { to: partner.partner_id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Offer ${firstName} an incentive`}
            style={[styles.action, styles.offer]}>
            <AppText
              variant="heading"
              color={Colors.flame}
              style={styles.actionText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              🎁 Incentive
            </AppText>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function Stat({ icon, color, text }: { icon: 'flame.fill' | 'checkmark.circle.fill' | 'circle.dashed'; color: ColorValue; text: string }) {
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
  actions: { flexDirection: 'row', gap: Spacing.sm },
  offer: { backgroundColor: Colors.flameSoft },
  incentive: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.flameSoft,
  },
  incentiveHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  incentiveEarned: { backgroundColor: Colors.xpSoft, borderWidth: 1, borderColor: Colors.success },
  // Big, equal-width buttons that are easy to hit (Apple's minimum is 44pt tall).
  action: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
  },
  actionText: { fontSize: 16 },
});
