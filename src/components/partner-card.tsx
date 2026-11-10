import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Alert, LayoutAnimation, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

/** A tile is this wide, so three fit on a phone and the next one peeks in at the edge. */
const TILE_WIDTH = 92;
const RING = 84;
const RING_STROKE = 6;

/**
 * Your partners as one row of buddies you scroll sideways, each inside a ring
 * that fills with their week, with Nudge and Challenge under it, then an Add
 * tile. Challenges between you and a partner are listed under the row.
 */
export function PartnerList({ partners }: { partners: PartnerState[] }) {
  // Every challenge between you and each partner that's still going, or earned and waiting to be delivered.
  const { given, received } = useMyIncentives();
  const challengesWith = (p: PartnerState) =>
    [...given, ...received].filter(
      (i) => (i.to_id === p.partner_id || i.from_id === p.partner_id) && (isOpen(i) || i.status === 'earned'),
    );
  const canChallenge = (p: PartnerState) => !given.some((i) => i.to_id === p.partner_id && isOpen(i));

  return (
    <Card style={{ gap: Spacing.md }}>
      <AppText variant="label">This week</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}>
        {partners.map((p) => (
          <PartnerTile key={p.partnership_id} partner={p} canChallenge={canChallenge(p)} />
        ))}
        <AddTile />
      </ScrollView>
      {partners.map((p) => {
        const challenges = challengesWith(p);
        const firstName = p.display_name?.split(' ')[0] ?? '';
        return challenges.length > 0 ? (
          <Challenges key={p.partnership_id} challenges={challenges} firstName={firstName} />
        ) : null;
      })}
    </Card>
  );
}

function PartnerTile({ partner, canChallenge }: { partner: PartnerState; canChallenge: boolean }) {
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
  const week = partner.resting ? 'Resting' : `${partner.this_week_days}/${partner.this_week_goal}`;

  const confirmRemove = () =>
    Alert.alert(`Remove ${partner.display_name ?? 'partner'}?`, 'You will stop seeing each other’s workouts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(partner.partnership_id) },
    ]);

  return (
    <View style={styles.tile}>
      <Pressable
        onPress={() => router.push({ pathname: '/partner/[id]', params: { id: partner.partner_id } })}
        onLongPress={confirmRemove}
        accessibilityRole="button"
        accessibilityLabel={`${firstName}, ${
          partner.resting ? 'resting this week' : `${partner.this_week_days} of ${partner.this_week_goal} days this week`
        }, buddy ${MASCOTS[mascotKind(partner.mascot)].name}`}
        accessibilityHint={`Opens ${firstName}’s workouts`}
        style={({ pressed }) => [styles.tileTop, pressed && { opacity: 0.7 }]}>
        <WeekRing progress={progress} done={done && !partner.resting}>
          <Mascot kind={mascotKind(partner.mascot)} mood={mood} size={50} />
        </WeekRing>
        <AppText variant="heading" numberOfLines={1} style={{ fontSize: 15 }}>
          {firstName}
        </AppText>
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: '/streak', params: { tab: 'friends' } })}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Friend streak with ${firstName}: ${partner.friend_streak} weeks`}>
        <AppText variant="caption">
          {week} ·{' '}
          <AppText variant="caption" color={partner.friend_streak ? Colors.xp : Colors.textMuted}>
            🔥 {partner.friend_streak}
          </AppText>
        </AppText>
      </Pressable>
      <View style={styles.tileActions}>
        {/* The Nudge slot stays even when it's empty, so every tile's Challenge lines up. */}
        {done || partner.resting ? (
          <View style={styles.mini} />
        ) : (
          <Pressable
            disabled={recentlyNudged || nudge.isPending}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              nudge.mutate(partner.partner_id, {
                onError: (e) => Alert.alert('Couldn’t nudge', friendlyError(e)),
              });
            }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={recentlyNudged ? `Nudged ${firstName}` : `Nudge ${firstName}`}
            style={[styles.mini, styles.miniFilled, recentlyNudged && { opacity: 0.5 }]}>
            <AppText variant="heading" style={styles.miniText} numberOfLines={1}>
              {recentlyNudged ? 'Nudged 👋' : '👋 Nudge'}
            </AppText>
          </Pressable>
        )}
        {canChallenge ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: '/incentive/new', params: { to: partner.partner_id } });
            }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Challenge ${firstName}`}
            style={[styles.mini, styles.offer]}>
            <AppText
              variant="heading"
              color={Colors.flame}
              style={styles.miniText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              🎯 Challenge
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.mini} />
        )}
      </View>
    </View>
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
      <View style={{ paddingTop: 6 }}>{children}</View>
    </View>
  );
}

/** The last tile: a dashed ring that adds a partner. */
function AddTile() {
  return (
    <Pressable
      onPress={() => router.push('/add-partner')}
      accessibilityRole="button"
      accessibilityLabel="Add a partner"
      accessibilityHint="Plus 100 XP for you both when a new friend joins and works out"
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <View style={styles.addRing}>
        <SymbolView name="plus" size={26} weight="semibold" tintColor={Colors.flame} />
      </View>
      <AppText variant="heading" color={Colors.flame} style={{ fontSize: 15 }}>
        Add
      </AppText>
      <AppText variant="caption">🎁 +100 XP</AppText>
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
  // The row runs to the card's edges so the next tile peeks in.
  strip: { marginHorizontal: -Spacing.md },
  stripContent: { paddingHorizontal: Spacing.md, gap: 10 },
  tile: { width: TILE_WIDTH, alignItems: 'center', gap: 2 },
  tileTop: { alignItems: 'center', gap: 2 },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  addRing: {
    width: RING - 8,
    height: RING - 8,
    margin: 4,
    borderRadius: RING,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActions: { alignSelf: 'stretch', gap: 6, marginTop: Spacing.xs },
  // 36pt tall plus a 4pt hit slop on each side reaches Apple's 44pt minimum.
  mini: { minHeight: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  miniFilled: { backgroundColor: Colors.cardRaised },
  miniText: { fontSize: 13 },
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
});
