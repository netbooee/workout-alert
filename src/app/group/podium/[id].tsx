import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, Keyframe } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti } from '@/components/confetti';
import { Mascot } from '@/components/mascots';
import { AppText, Button } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useGroupBoard, useMyGroups } from '@/hooks/use-groups';
import type { GroupMemberRow } from '@/lib/database.types';
import { myPodiumLine, podium, podiumSteps, podiumWeekLabel, type PodiumPlace } from '@/lib/groups';
import { MEDALS } from '@/lib/leagues';
import { mascotKind } from '@/lib/mascots';
import { playSound } from '@/lib/sounds';
import { treats } from '@/lib/treats';

/** When each step is revealed (ms): bronze, then silver, then gold, for suspense. */
const REVEAL_AT = [2600, 1600, 600] as const;
/** After gold lands: your own line and the button. */
const OUTRO_AT = REVEAL_AT[0] + 1300;
/** Left to right on screen: silver, gold, bronze. */
const LAYOUT = [1, 0, 2] as const;
const STEP_HEIGHT = [150, 110, 80] as const;
const STEP_COLOR = [Colors.xp, '#C9CDD6', '#D9985A'] as const;
const MAX_SHOWN = 3;

/**
 * The medal ceremony: last week's podium, revealed bronze → silver → gold,
 * each buddy dropping onto its step as its medal swings in. Plays once per
 * group and week, the first time you open the group after the week ends
 * (see the group screen), and again from "Replay" on the podium card.
 */
export default function PodiumCeremonyScreen() {
  // ?preview=1 shows made-up results (development builds only).
  const { id, preview } = useLocalSearchParams<{
    id: string;
    preview?: string;
  }>();
  const sample = __DEV__ && preview === '1';
  const { data: groups } = useMyGroups();
  const { data: liveRows } = useGroupBoard(sample ? '' : id);
  const group = groups?.find((g) => g.id === id);
  const rows = sample ? SAMPLE_ROWS : liveRows;
  const steps = podiumSteps(
    rows
      ? podium(rows).map((p) => ({
          ...p,
          mascot: rows.find((r) => r.user_id === p.user_id)!.mascot,
        }))
      : [],
  );
  const [confetti, setConfetti] = useState(false);

  // Sound and haptics land with each medal.
  const ready = !!rows;
  // Which steps have someone on them, e.g. "true,true,false" (a stable effect dependency).
  const filled = steps.map((s) => s.length > 0).join();
  useEffect(() => {
    if (!ready) return;
    const timers = [2, 1, 0].map((m) =>
      setTimeout(() => {
        if (filled.split(',')[m] !== 'true') return;
        if (m === 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          playSound('levelup');
          setConfetti(true);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          playSound('pop');
        }
      }, REVEAL_AT[m] + 650),
    );
    return () => timers.forEach(clearTimeout);
  }, [ready, filled]);

  const summary = steps
    .map((s, m) => (s.length ? `${['Gold', 'Silver', 'Bronze'][m]}: ${s.map(nameOf).join(' and ')}` : null))
    .filter(Boolean)
    .join('. ');

  return (
    <SafeAreaView style={styles.container}>
      {confetti && <Confetti />}
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" style={styles.skip}>
        <AppText variant="heading" color={Colors.textSecondary}>
          Skip
        </AppText>
      </Pressable>

      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <AppText variant="label" color={Colors.textSecondary}>
          {podiumWeekLabel(new Date())} · Final standings
        </AppText>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {sample ? '🏋️ Gym Rats' : group ? `${group.emoji} ${group.name}` : ''}
        </AppText>
        <AppText variant="heading" color={Colors.xp}>
          🏆 Medal ceremony
        </AppText>
      </Animated.View>

      <View style={styles.stage} accessible accessibilityLabel={summary}>
        {ready && LAYOUT.map((m) => <Step key={m} medal={m} people={steps[m]!} />)}
      </View>

      <View style={styles.outro}>
        {ready && (
          <Animated.View entering={FadeInDown.delay(OUTRO_AT)} style={{ gap: Spacing.md }}>
            <AppText variant="heading" style={{ textAlign: 'center' }}>
              {myPodiumLine(rows!)}
            </AppText>
            <Button title="See this week’s race" onPress={() => router.back()} />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

function nameOf(p: PodiumPlace): string {
  return p.is_me ? 'You' : p.name;
}

/** One podium step: it rises, then its buddies drop on, then the medal swings in. */
function Step({ medal, people }: { medal: number; people: (PodiumPlace & { mascot: string })[] }) {
  const at = REVEAL_AT[medal]!;
  const shown = people.slice(0, MAX_SHOWN);
  const size = shown.length <= 1 ? 76 : shown.length === 2 ? 52 : 38;

  return (
    <View style={styles.column}>
      {people.length > 0 && (
        <>
          <Animated.View entering={medalSwing().delay(at + 650)}>
            <AppText style={styles.medal}>{MEDALS[medal]}</AppText>
          </Animated.View>
          <View style={styles.people}>
            {shown.map((p, i) => (
              <Animated.View key={p.user_id} entering={drop().delay(at + 300 + i * 120)}>
                <Mascot kind={mascotKind(p.mascot)} mood={medal === 0 ? 'blazing' : 'happy'} size={size} />
              </Animated.View>
            ))}
          </View>
          <Animated.View entering={FadeIn.delay(at + 800)} style={styles.caption}>
            <AppText variant="heading" numberOfLines={2} style={{ textAlign: 'center' }}>
              {shown.map(nameOf).join(' & ')}
              {people.length > MAX_SHOWN ? ` +${people.length - MAX_SHOWN}` : ''}
            </AppText>
            <AppText variant="caption" color={Colors.xp} style={{ fontWeight: '800' }}>
              {treats(people[0]!.xp)}
            </AppText>
          </Animated.View>
        </>
      )}
      <Animated.View
        entering={rise(STEP_HEIGHT[medal]!).delay(at)}
        style={[
          styles.block,
          {
            height: STEP_HEIGHT[medal],
            backgroundColor: people.length ? STEP_COLOR[medal] : Colors.cardRaised,
          },
        ]}
      >
        <AppText style={[styles.place, !people.length && { color: Colors.textMuted }]}>{medal + 1}</AppText>
      </Animated.View>
    </View>
  );
}

const rise = (height: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: height }] },
    100: {
      opacity: 1,
      transform: [{ translateY: 0 }],
      easing: Easing.out(Easing.back(1.4)),
    },
  }).duration(500);

// Factories: Keyframe.delay() mutates the instance, so each use needs its own.
const drop = () =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: -260 }, { scale: 0.9 }] },
    60: {
      opacity: 1,
      transform: [{ translateY: 10 }, { scale: 1.05 }],
      easing: Easing.in(Easing.quad),
    },
    80: { transform: [{ translateY: -6 }, { scale: 0.98 }] },
    100: { transform: [{ translateY: 0 }, { scale: 1 }] },
  }).duration(600);

const medalSwing = () =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0 }, { rotate: '-40deg' }] },
    50: { opacity: 1, transform: [{ scale: 1.35 }, { rotate: '18deg' }] },
    75: { transform: [{ scale: 0.95 }, { rotate: '-8deg' }] },
    100: { transform: [{ scale: 1 }, { rotate: '0deg' }] },
  }).duration(700);

/** For ?preview=1: a tie for gold, so every part of the ceremony shows. */
const SAMPLE_ROWS: GroupMemberRow[] = [
  ['Maria', 'red_panda', 420, false],
  ['Alex', 'lotl', 420, true],
  ['Sam', 'capybara', 310, false],
  ['Lee', 'sloth', 180, false],
  ['Ana', 'lotl', 60, false],
].map(([name, mascot, xp, is_me], i) => ({
  user_id: `sample-${i}`,
  name: name as string,
  mascot: mascot as string,
  avatar_url: null,
  role: 'member',
  xp: 0,
  last_week_xp: xp as number,
  this_week_days: 0,
  this_week_goal: 3,
  week_status: 'in_progress',
  is_me: is_me as boolean,
}));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  skip: { alignSelf: 'flex-end', padding: Spacing.xs },
  header: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  stage: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  people: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  medal: { fontSize: 40, lineHeight: 48 },
  caption: { alignItems: 'center', minHeight: 44 },
  block: {
    alignSelf: 'stretch',
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  place: {
    fontFamily: Font.rounded,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: '#000',
  },
  outro: { minHeight: 130, justifyContent: 'flex-end', marginTop: Spacing.lg },
});
