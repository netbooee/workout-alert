import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelBar } from '@/components/level-bar';
import { AppText, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useHomeData } from '@/hooks/use-home-data';
import { useXpTotal } from '@/hooks/use-social';
import { levelFor } from '@/lib/levels';

/** The Duolingo-style "lesson complete" moment after new activity earns XP. */
export default function CelebrateScreen() {
  const params = useLocalSearchParams<{ xp: string; workouts: string; weekGoal: string; evidence: string }>();
  const earned = Number(params.xp) || 0;
  const workouts = Number(params.workouts) || 0;
  const weekGoal = params.weekGoal === '1';
  const { data: total } = useXpTotal();
  const { data: home } = useHomeData();
  const shown = useCountUp(earned);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const leveledUp = total != null && levelFor(total - earned).level < levelFor(total).level;
  const title = weekGoal
    ? 'Week goal hit!'
    : workouts > 1
      ? `${workouts} workouts logged!`
      : workouts === 1
        ? 'Workout logged!'
        : 'Check-in added!';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.burst}>
          <SymbolView
            name={weekGoal ? 'flame.fill' : leveledUp ? 'star.fill' : 'bolt.fill'}
            size={96}
            tintColor={weekGoal ? Colors.flame : Colors.xp}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)} style={styles.center}>
          <AppText variant="title" style={{ fontSize: 32, textAlign: 'center' }}>
            {leveledUp ? `Level ${levelFor(total!).level}!` : title}
          </AppText>
          <AppText variant="display" color={Colors.xp}>
            +{shown} XP
          </AppText>
        </Animated.View>

        {weekGoal && home?.streak && (
          <Animated.View entering={FadeInDown.delay(350)} style={styles.pill}>
            <AppText variant="heading" color={Colors.flame}>
              🔥 {home.streak.current_weeks} week streak
            </AppText>
          </Animated.View>
        )}

        {total != null && (
          <Animated.View entering={FadeInDown.delay(500)} style={styles.level}>
            <LevelBar xp={total} />
          </Animated.View>
        )}
      </View>

      <Animated.View entering={FadeInDown.delay(700)}>
        <Button title="Continue" onPress={() => router.back()} />
      </Animated.View>
    </SafeAreaView>
  );
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
});
