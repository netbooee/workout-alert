import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelBar } from '@/components/level-bar';
import { Mascot } from '@/components/mascots';
import { AppText, Button } from '@/components/ui';
import { WeekDots } from '@/components/week-dots';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useHomeData } from '@/hooks/use-home-data';
import { useLeagueSettings } from '@/hooks/use-league';
import { useXpTotal } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { buddyLine, celebrationMood, celebrationTitle } from '@/lib/celebration-copy';
import type { Streak } from '@/lib/database.types';
import { levelFor } from '@/lib/levels';
import { mascotKind } from '@/lib/mascots';
import { earnedFreezeAt, isMilestone, milestoneLabel } from '@/lib/streak';
import { buildWeek, weekState, type WeekState, type WorkoutLike } from '@/lib/week';

/**
 * The Duolingo-style "lesson complete" moment after new activity earns XP:
 * your buddy calls out what happened (a workout, a photo, a step tier...)
 * over the XP count. New workouts get a second step showing the streak.
 */
export default function CelebrateScreen() {
  const params = useLocalSearchParams<{
    xp: string;
    workouts: string;
    weekGoal: string;
    evidence: string;
    incentive: string;
    steps: string;
    invite: string;
  }>();
  const profile = useProfile();
  const earned = Number(params.xp) || 0;
  const workouts = Number(params.workouts) || 0;
  const weekGoal = params.weekGoal === '1';
  const incentive = params.incentive === '1';
  const steps = Number(params.steps) || 0;
  const { data: total } = useXpTotal();
  const { data: home } = useHomeData();
  const shown = useCountUp(earned);
  const league = useLeagueSettings();
  // A week goal is a good moment to suggest competing beyond your partners.
  const inviteToLeague = weekGoal && league.isSuccess && !league.data;
  const [step, setStep] = useState<'xp' | 'streak'>('xp');
  const hasStreakStep = (workouts > 0 || weekGoal) && !!home?.streak;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const leveledUp = total != null && levelFor(total - earned).level < levelFor(total).level;
  const facts = {
    workouts,
    weekGoal,
    evidence: params.evidence === '1',
    incentive,
    steps,
    invite: params.invite === 'inviter' ? ('inviter' as const) : params.invite === 'welcome' ? ('welcome' as const) : null,
    newLevel: leveledUp ? levelFor(total!).level : null,
  };

  if (step === 'streak' && home?.streak) {
    return <StreakStep streak={home.streak} weekWorkouts={home.weekWorkouts} weekGoal={weekGoal} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Animated.View entering={FadeInDown.delay(250)} style={styles.bubble}>
          <AppText variant="heading" style={{ textAlign: 'center' }}>
            {buddyLine(facts)}
          </AppText>
          <View style={styles.bubbleTail} />
        </Animated.View>
        <Animated.View
          entering={ZoomIn.springify().damping(9)}
          style={[styles.burst, weekGoal && styles.flameBurst]}>
          <Mascot kind={mascotKind(profile.mascot)} mood={celebrationMood(facts)} size={150} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)} style={styles.center}>
          <AppText variant="title" style={{ fontSize: 32, textAlign: 'center' }}>
            {celebrationTitle(facts)}
          </AppText>
          <AppText variant="display" color={Colors.xp}>
            +{shown} XP
          </AppText>
        </Animated.View>

        {steps > 0 && (workouts > 0 || weekGoal || facts.evidence || incentive) && (
          <Animated.View entering={FadeInDown.delay(300)} style={[styles.pill, { backgroundColor: Colors.xpSoft }]}>
            <AppText variant="heading">👟 {steps.toLocaleString()} steps today</AppText>
          </Animated.View>
        )}

        {weekGoal && home?.streak && (
          <Animated.View entering={FadeInDown.delay(350)} style={styles.pill}>
            <AppText variant="heading" color={Colors.flame}>
              🔥 {home.streak.current_weeks} week streak
            </AppText>
          </Animated.View>
        )}

        {total != null && (
          <Animated.View entering={FadeInDown.delay(500)} style={styles.level}>
            <LevelBar xp={total} pressable={false} />
          </Animated.View>
        )}
      </View>

      <Animated.View entering={FadeInDown.delay(700)} style={{ gap: Spacing.sm }}>
        <Button title="Continue" onPress={() => (hasStreakStep ? setStep('streak') : router.back())} />
        {inviteToLeague && (
          <Button
            title="🏆 Compete in public leagues"
            variant="secondary"
            onPress={() => router.replace('/league')}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function StreakStep({
  streak,
  weekWorkouts,
  weekGoal,
}: {
  streak: Streak;
  weekWorkouts: readonly WorkoutLike[];
  weekGoal: boolean;
}) {
  const profile = useProfile();
  const days = buildWeek(weekWorkouts, profile.min_workout_minutes);
  const state = weekState(days.filter((d) => d.active).length, profile.weekly_goal);
  const weeks = streak.current_weeks;
  const lit = weeks > 0 || state.kind === 'done';

  useEffect(() => {
    if (weekGoal) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [weekGoal]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Animated.View entering={ZoomIn.springify().damping(9)} style={[styles.burst, styles.flameBurst]}>
          <SymbolView
            name="flame.fill"
            size={96}
            tintColor={lit ? Colors.flame : Colors.textMuted}
            animationSpec={lit ? { effect: { type: 'bounce' } } : undefined}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)} style={styles.center}>
          <AppText variant="display" color={lit ? Colors.flame : Colors.text}>
            {weeks}
          </AppText>
          <AppText variant="heading" color={lit ? Colors.flame : Colors.textSecondary}>
            week streak
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.level}>
          <WeekDots days={days} goal={profile.weekly_goal} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450)} style={styles.center}>
          <AppText variant="body" style={{ textAlign: 'center' }}>
            {nextStepLine(state, streak, weekGoal)}
          </AppText>
          {weekGoal && isMilestone(weeks) && (
            <View style={styles.pill}>
              <AppText variant="heading" color={Colors.flame}>
                🏆 {milestoneLabel(weeks)} milestone
              </AppText>
            </View>
          )}
          {weekGoal && earnedFreezeAt(weeks) && (
            <View style={[styles.pill, { backgroundColor: Colors.cardRaised }]}>
              <AppText variant="heading" color={Colors.freeze}>
                ❄️ Freeze earned
              </AppText>
            </View>
          )}
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(600)} style={{ gap: Spacing.sm }}>
        <Button title="Keep it going" onPress={() => router.back()} />
        {weekGoal && isMilestone(weeks) && (
          <Button
            title="📤 Share my streak"
            variant="secondary"
            onPress={() => router.replace({ pathname: '/share', params: { kind: 'streak', weeks: String(weeks) } })}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

/** What this workout means for the week, looking forward rather than back. */
function nextStepLine(state: WeekState, streak: Streak, weekGoal: boolean): string {
  const weeks = streak.current_weeks;
  const days = (n: number) => `${n} more day${n === 1 ? '' : 's'}`;
  switch (state.kind) {
    case 'done':
      return weekGoal
        ? `Goal hit. Week ${weeks} is in the books 🔥`
        : 'Goal already hit this week. Extra days still earn XP.';
    case 'on-track':
    case 'at-risk':
      return weeks > 0
        ? `${days(state.needed)} this week keeps your streak going.`
        : `${days(state.needed)} this week starts your streak.`;
    case 'out-of-reach':
      return weeks > 0 && streak.freezes_banked > 0
        ? 'This week is out of reach, but a freeze will cover it ❄️'
        : 'Every workout still counts. Fresh week on Sunday.';
  }
}

function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / durationMs, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t === 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, durationMs]);
  return value;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  bubble: {
    maxWidth: 300,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: -Spacing.sm,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
    backgroundColor: Colors.card,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  burst: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.xpSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.flameSoft,
  },
  level: { alignSelf: 'stretch' },
  flameBurst: { backgroundColor: Colors.flameSoft },
});
