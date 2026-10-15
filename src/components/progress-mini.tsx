import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useProgressWorkouts } from '@/hooks/use-home-data';
import { niceMax, weeklyAverage, weeklyTotals } from '@/lib/progress';
import { formatDuration } from '@/lib/workout-types';

const WEEKS = 8;
const HEIGHT = 44;

/** Home's glance at the trend: active minutes for the last 8 weeks. Taps through to Progress on Me. */
export function ProgressMini() {
  const { data: workouts } = useProgressWorkouts();
  const totals = useMemo(() => weeklyTotals(workouts ?? [], WEEKS), [workouts]);
  const average = weeklyAverage(totals, 'minutes');
  const max = niceMax(Math.max(average, ...totals.map((t) => t.minutes)));

  return (
    <Pressable
      onPress={() => router.navigate('/me')}
      accessibilityRole="button"
      accessibilityLabel={`Active minutes, last ${WEEKS} weeks. Average ${formatDuration(average * 60)} a week. Opens Progress.`}>
      <Card>
        <View style={styles.header}>
          <AppText variant="label">Last {WEEKS} weeks</AppText>
          <View style={styles.average}>
            <AppText variant="caption">
              {average > 0 ? `${formatDuration(average * 60)} / week avg` : 'Active minutes'}
            </AppText>
            <SymbolView name="chevron.right" size={12} tintColor={Colors.textMuted} />
          </View>
        </View>
        <View style={styles.bars}>
          {totals.map((t) => (
            <View
              key={t.weekStart}
              style={[
                styles.bar,
                {
                  height: t.minutes > 0 ? Math.max(4, (t.minutes / max) * HEIGHT) : 3,
                  backgroundColor:
                    t.minutes === 0 ? Colors.cardRaised : t.isCurrent ? Colors.flameSoft : Colors.flame,
                  borderColor: t.isCurrent && t.minutes > 0 ? Colors.flame : 'transparent',
                },
              ]}
            />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  average: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  bars: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  bar: { flex: 1, borderRadius: 3, borderWidth: 1 },
});
