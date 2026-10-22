import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, LayoutAnimation, Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Mascot } from '@/components/mascots';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useNudge, useRemovePartner, type PartnerState } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import type { Incentive } from '@/lib/database.types';
import { goalOption, isOpen, progressFraction, timeLeft } from '@/lib/incentives';
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
  // Every challenge between you two that's still going, or earned and waiting to be delivered.
  const { given, received } = useMyIncentives();
  const challenges = [...given, ...received].filter(
    (i) => (i.to_id === partner.partner_id || i.from_id === partner.partner_id) && (isOpen(i) || i.status === 'earned'),
  );
  const canChallenge = !given.some((i) => i.to_id === partner.partner_id && isOpen(i));

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
        <Avatar id={partner.partner_id} name={partner.display_name} size={40} />
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
          <Mascot kind={mascotKind(partner.mascot)} mood={mood} size={34} />
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/streak', params: { tab: 'friends' } })}
          accessibilityRole="button"
          accessibilityLabel={`Friend streak with ${firstName}: ${partner.friend_streak} weeks`}
          style={styles.friendStreak}>
          <View style={styles.friendStreakCount}>
            <AppText style={{ fontSize: 14 }}>🔥</AppText>
            <AppText variant="title" color={partner.friend_streak ? Colors.xp : Colors.textMuted} style={{ fontSize: 20 }}>
              {partner.friend_streak}
            </AppText>
          </View>
          <AppText variant="caption" style={styles.friendStreakLabel}>
            {partner.friend_streak === 1 ? 'week' : 'weeks'}
            {'\n'}together
          </AppText>
        </Pressable>
        <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={Colors.textMuted} />
      </Pressable>
      {challenges.length > 0 && <Challenges challenges={challenges} firstName={firstName} />}
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
        {canChallenge && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: '/incentive/new', params: { to: partner.partner_id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Challenge ${firstName}`}
            style={[styles.action, styles.offer]}>
            <AppText
              variant="heading"
              color={Colors.flame}
              style={styles.actionText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              🎯 Challenge
            </AppText>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/** One challenge reads as a single row; two or more fold into a summary you can open. */
function Challenges({ challenges, firstName }: { challenges: Incentive[]; firstName: string }) {
  const [open, setOpen] = useState(false);
  if (challenges.length === 1) return <ChallengeRow incentive={challenges[0]!} firstName={firstName} />;
  const ready = challenges.filter((i) => i.status === 'earned').length;
  const waiting = challenges.filter((i) => i.status === 'offered').length;
  const summary = ready
    ? `${ready} earned 🎉`
    : waiting
      ? `${waiting} waiting to be accepted`
      : challenges.map((i) => i.reward_emoji).join(' ');
  return (
    <View style={styles.challenges}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.challengeRow}>
        <AppText style={styles.challengeEmoji}>🎯</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" style={{ fontSize: 14 }}>
            {challenges.length} challenges with {firstName}
          </AppText>
          <AppText variant="caption" numberOfLines={1} style={{ fontSize: 12 }}>
            {summary}
          </AppText>
        </View>
        <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={12} weight="semibold" tintColor={Colors.textMuted} />
      </Pressable>
      {open &&
        challenges.map((i) => <ChallengeRow key={i.id} incentive={i} firstName={firstName} nested />)}
    </View>
  );
}

function ChallengeRow({ incentive: i, firstName, nested = false }: { incentive: Incentive; firstName: string; nested?: boolean }) {
  const me = useAuth().session?.user.id;
  const received = i.to_id === me;
  const status =
    i.status === 'earned'
      ? received && !i.shared
        ? 'You earned it! 🎉'
        : `Earned! Tap to mark ${i.shared ? 'done' : 'delivered'}`
      : i.status === 'offered'
        ? received
          ? 'Tap to accept'
          : `Waiting for ${firstName} to accept`
        : `${Math.min(i.progress, i.goal_target)}/${i.goal_target} ${goalOption(i.goal_kind).unit} · ${timeLeft(i.ends_at)}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/incentive/[id]', params: { id: i.id } })}
      accessibilityRole="button"
      style={[styles.challengeRow, nested && styles.nested, i.status === 'earned' && styles.challengeEarned]}>
      <AppText style={styles.challengeEmoji}>{i.reward_emoji}</AppText>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="heading" numberOfLines={1} style={{ fontSize: 14 }}>
          {i.shared ? '🤝 ' : ''}
          {i.reward}
        </AppText>
        {i.status === 'active' && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressFraction(i) * 100}%` }]} />
          </View>
        )}
        <AppText variant="caption" numberOfLines={1} style={{ fontSize: 12 }}>
          {status}
        </AppText>
      </View>
      <SymbolView name="chevron.right" size={12} tintColor={Colors.textMuted} />
    </Pressable>
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
    minWidth: 64,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.xpSoft,
  },
  friendStreakCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  friendStreakLabel: { fontSize: 10, lineHeight: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  offer: { backgroundColor: Colors.flameSoft },
  challenges: { gap: 6 },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.flameSoft,
  },
  nested: { marginLeft: Spacing.md, backgroundColor: Colors.cardRaised },
  challengeEarned: { backgroundColor: Colors.xpSoft, borderWidth: 1, borderColor: Colors.success },
  challengeEmoji: { fontSize: 20 },
  track: { height: 4, borderRadius: 2, backgroundColor: Colors.cardRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: Colors.flame },
  // Big, equal-width buttons that are easy to hit (Apple's minimum is 44pt tall).
  action: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
  },
  actionText: { fontSize: 15 },
});
