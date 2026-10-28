import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LevelBar } from '@/components/level-bar';
import { AppText, SectionLabel } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useHomeData } from '@/hooks/use-home-data';
import { useXpTotal } from '@/hooks/use-social';
import { levelFor, levelStart, TITLES } from '@/lib/levels';
import { nextStepTier, STEP_TIERS, stepXp } from '@/lib/step-xp';
import { XP_RULES } from '@/lib/xp-rules';

/** "How XP works": opened by tapping the level bar. */
export default function XpScreen() {
  const { data: xp } = useXpTotal();
  const total = xp ?? 0;
  const mine = levelFor(total);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="heading">How XP works</AppText>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <AppText variant="heading" color={Colors.flame}>
            Done
          </AppText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <LevelBar xp={total} pressable={false} />
          <AppText variant="caption">{total.toLocaleString()} XP total</AppText>
        </View>

        <SectionLabel>Earn XP</SectionLabel>
        <View style={styles.card}>
          {XP_RULES.map((r) => (
            <View key={r.what} style={styles.row}>
              <AppText style={styles.emoji}>{r.emoji}</AppText>
              <AppText variant="body" style={{ flex: 1 }}>
                {r.what}
              </AppText>
              <AppText variant="heading" color={Colors.xp}>
                {r.xp}
              </AppText>
            </View>
          ))}
        </View>

        <StepBonus />

        <SectionLabel>What resets</SectionLabel>
        <View style={styles.card}>
          <AppText variant="body">
            <AppText variant="body" style={styles.bold}>
              Your XP and level never reset.
            </AppText>{' '}
            XP is only taken back if what earned it is undone, like deleting a workout.
          </AppText>
          <AppText variant="body">
            <AppText variant="body" style={styles.bold}>
              Leagues start over every Sunday
            </AppText>{' '}
            at midnight, counting only XP earned that week. In public leagues, hand-logged
            workouts without a photo count half.
          </AppText>
          <AppText variant="body">
            <AppText variant="body" style={styles.bold}>
              Streaks are separate:
            </AppText>{' '}
            a missed week (with no freeze) resets your streak, never your XP.
          </AppText>
        </View>

        <SectionLabel>Levels</SectionLabel>
        <View style={styles.card}>
          {TITLES.map(([minLevel, title], i) => {
            const next = TITLES[i + 1]?.[0];
            const current = mine.title === title;
            return (
              <View key={title} style={styles.row}>
                <AppText variant="body" style={[{ flex: 1 }, current && styles.bold]}>
                  {current ? `${title} (you)` : title}
                </AppText>
                <AppText variant="caption">
                  {next ? `Levels ${minLevel}–${next - 1}` : `Level ${minLevel}+`} ·{' '}
                  {levelStart(minLevel).toLocaleString()} XP
                </AppText>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** The daily step tiers, with how far today's steps have got. */
function StepBonus() {
  const { data } = useHomeData();
  const steps = data?.today?.steps ?? 0;
  const next = nextStepTier(steps);
  return (
    <>
      <SectionLabel>Step bonus, every day</SectionLabel>
      <View style={styles.card}>
        {STEP_TIERS.map((t) => {
          const done = steps >= t.steps;
          return (
            <View key={t.steps} style={styles.row}>
              <AppText style={styles.emoji}>{done ? '✅' : '👟'}</AppText>
              <AppText variant="body" style={[{ flex: 1 }, done && styles.bold]}>
                {t.steps.toLocaleString()} steps
              </AppText>
              <AppText variant="heading" color={done ? Colors.success : Colors.xp}>
                +{t.xp}
              </AppText>
            </View>
          );
        })}
        <AppText variant="caption">
          Today: {steps.toLocaleString()} steps · +{stepXp(steps)} XP
          {next ? ` · ${(next.steps - steps).toLocaleString()} more for +${next.xp}` : ' · every bonus earned 🎉'}
        </AppText>
        <AppText variant="caption">
          Up to 25 XP a day from Apple Health’s step count. Steps earn XP only; they don’t count
          toward your streak or challenges.
        </AppText>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  content: { padding: Spacing.md, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xl },
  // Same look as the shared Card.
  card: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 22, lineHeight: 28, width: 30 },
  bold: { fontWeight: '700', color: Colors.text },
});
