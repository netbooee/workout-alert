import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Alert, LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Mascot } from '@/components/mascots';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useNudge, useRemovePartner, type PartnerState } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import type { Incentive } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import { goalOption, isOpen, progressFraction, timeLeft } from '@/lib/incentives';
import { partnerMood } from '@/lib/lotl';
import { MASCOTS, mascotKind } from '@/lib/mascots';
import { orderPartners } from '@/lib/partner-order';

const RING = 46;
const RING_STROKE = 4;

/**
 * Your partners, one row each: their buddy inside a ring that fills with their
 * week, their days and friend streak, and round Challenge and Nudge buttons.
 * Whoever needs a nudge comes first. An Add row ends the list, and challenges
 * between you and a partner are listed under it.
 */
export function PartnerList({ partners }: { partners: PartnerState[] }) {
  // Every challenge between you and each partner that's still going, or earned and waiting to be delivered.
  const { given, received } = useMyIncentives();
  const challengesWith = (p: PartnerState) =>
    [...given, ...received].filter(
      (i) => (i.to_id === p.partner_id || i.from_id === p.partner_id) && (isOpen(i) || i.status === 'earned'),
    );
  const canChallenge = (p: PartnerState) => !given.some((i) => i.to_id === p.partner_id && isOpen(i));
  const ordered = orderPartners(partners);

  return (
    <Card style={styles.card}>
      {ordered.map((p) => (
        <View key={p.partnership_id}>
          <PartnerRow partner={p} canChallenge={canChallenge(p)} />
          <View style={styles.divider} />
        </View>
      ))}
      <AddRow />
      {ordered.map((p) => {
        const challenges = challengesWith(p);
        const firstName = p.display_name?.split(' ')[0] ?? '';
        return challenges.length > 0 ? (
          <Challenges key={p.partnership_id} challenges={challenges} firstName={firstName} />
        ) : null;
      })}
    </Card>
  );
}

function PartnerRow({ partner, canChallenge }: { partner: PartnerState; canChallenge: boolean }) {
  const nudge = useNudge();
  const remove = useRemovePartner();
  const done = partner.this_week_days >= partner.this_week_goal;
  const recentlyNudged = partner.recently_nudged;
  const firstName = partner.display_name?.split(' ')[0] || 'Partner';
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
  const progress = partner.resting ? 0 : Math.min(partner.this_week_days / Math.max(partner.this_week_goal, 1), 1);
  const week = partner.resting
    ? 'Resting this week'
    : `${partner.this_week_days} of ${partner.this_week_goal} days`;
  const together = partner.friend_streak
    ? ` · ${partner.friend_streak} week${partner.friend_streak === 1 ? '' : 's'} together`
    : '';
  const canNudge = !done && !partner.resting;

  const confirmRemove = () =>
    Alert.alert(`Remove ${partner.display_name ?? 'partner'}?`, 'You will stop seeing each other’s workouts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(partner.partnership_id) },
    ]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push({ pathname: '/partner/[id]', params: { id: partner.partner_id } })}
        onLongPress={confirmRemove}
        accessibilityRole="button"
        accessibilityLabel={`${firstName}, ${week}${together}, buddy ${MASCOTS[mascotKind(partner.mascot)].name}`}
        accessibilityHint={`Opens ${firstName}’s workouts. Hold to remove.`}
        style={({ pressed }) => [styles.who, pressed && { opacity: 0.7 }]}>
        <WeekRing progress={progress} done={done && !partner.resting}>
          <Mascot kind={mascotKind(partner.mascot)} mood={mood} size={30} />
        </WeekRing>
        <View style={{ flex: 1, gap: 1 }}>
          <AppText style={styles.name} numberOfLines={1}>
            {firstName}
          </AppText>
          <AppText variant="caption" numberOfLines={1} style={{ fontSize: 12 }}>
            {week}
            {together}
          </AppText>
        </View>
      </Pressable>
      {canChallenge && (
        <RoundButton
          label={`Challenge ${firstName}`}
          emoji="🎯"
          onPress={() => {
            Haptics.selectionAsync();
            router.push({ pathname: '/incentive/new', params: { to: partner.partner_id } });
          }}
        />
      )}
      {canNudge && (
        <RoundButton
          label={recentlyNudged ? `Nudged ${firstName}` : `Nudge ${firstName}`}
          emoji="👋"
          muted={recentlyNudged}
          disabled={recentlyNudged || nudge.isPending}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            nudge.mutate(partner.partner_id, {
              onError: (e) => Alert.alert('Couldn’t nudge', friendlyError(e)),
            });
          }}
        />
      )}
    </View>
  );
}

function RoundButton({
  label,
  emoji,
  onPress,
  muted = false,
  disabled = false,
}: {
  label: string;
  emoji: string;
  onPress: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.round, muted && styles.roundMuted, pressed && { opacity: 0.7 }]}>
      <AppText style={[styles.roundText, muted && { opacity: 0.45 }]}>{emoji}</AppText>
    </Pressable>
  );
}

/** The ring around a buddy: it fills with the week, and turns green once the goal is hit. */
function WeekRing({ progress, done, children }: { progress: number; done: boolean; children: ReactNode }) {
  const r = RING / 2 - RING_STROKE / 2;
  const length = 2 * Math.PI * r;
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={Colors.cardRaised} strokeWidth={RING_STROKE} fill="none" />
        {progress > 0 && (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={done ? Colors.success : Colors.flame}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${length * progress} ${length}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        )}
      </Svg>
      <View style={{ paddingTop: 3 }}>{children}</View>
    </View>
  );
}

/** The last row: a dashed circle that adds a partner. */
function AddRow() {
  return (
    <Pressable
      onPress={() => router.push('/add-partner')}
      accessibilityRole="button"
      accessibilityLabel="Add a partner"
      accessibilityHint="Plus 100 XP for you both when a new friend joins and works out"
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.addRing}>
        <SymbolView name="plus" size={18} weight="semibold" tintColor={Colors.flame} />
      </View>
      <AppText style={[styles.name, { flex: 1, color: Colors.flame }]}>Add a partner</AppText>
      <View style={styles.bonus}>
        <AppText style={styles.bonusText}>🎁 +100 XP</AppText>
      </View>
    </Pressable>
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
          {/* Under the row of partners, a lone challenge says who it's with. */}
          {nested ? '' : ` · with ${firstName}`}
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

const styles = StyleSheet.create({
  card: { paddingVertical: Spacing.xs, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: RING + Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 62 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 56 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: Colors.text },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  addRing: {
    width: RING - 6,
    height: RING - 6,
    margin: 3,
    borderRadius: RING,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Colors.xpSoft },
  bonusText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: Colors.text },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.flameSoft,
  },
  roundMuted: { backgroundColor: Colors.cardRaised },
  roundText: { fontSize: 18, lineHeight: 22 },
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
});
