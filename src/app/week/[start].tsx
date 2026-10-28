import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ColorValue } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { WorkoutRow } from '@/components/workout-row';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useWeekDetail } from '@/hooks/use-home-data';
import type { StreakWeek } from '@/lib/database.types';
import { weekRangeLabel } from '@/lib/progress';
import { formatDuration } from '@/lib/workout-types';
import { addDays, dayKey } from '@/lib/week';

const STATUS: Record<StreakWeek['status'], { label: string; color: ColorValue }> = {
  hit: { label: 'Goal hit 🔥', color: Colors.flame },
  frozen: { label: 'Covered by a freeze', color: Colors.freeze },
  missed: { label: 'Goal missed', color: Colors.textSecondary },
  in_progress: { label: 'In progress', color: Colors.textSecondary },
  rest: { label: 'Rest week', color: Colors.rest },
};

/** One week from the Progress chart: totals, streak status, and workouts by day. */
export default function WeekScreen() {
  const { start } = useLocalSearchParams<{ start: string }>();
  const { data, isPending, error } = useWeekDetail(start);

  const title = <Stack.Screen options={{ title: weekRangeLabel(start) }} />;
  if (isPending) {
    return (
      <View style={styles.centered}>
        {title}
        <ActivityIndicator color={Colors.flame} />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.centered}>
        {title}
        <AppText variant="body">{error?.message ?? 'Couldn’t load this week.'}</AppText>
      </View>
    );
  }

  const minutes = data.workouts.reduce((sum, w) => sum + w.duration_s / 60, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(data.start, i);
    const key = dayKey(date);
    return {
      date,
      key,
      workouts: data.workouts.filter((w) => dayKey(new Date(w.started_at)) === key),
    };
  });
  const status = data.week ? STATUS[data.week.status] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {title}
      {status && data.week && (
        <View style={[styles.status, { borderColor: status.color }]}>
          <AppText variant="heading" color={status.color}>
            {status.label}
          </AppText>
          <AppText variant="caption">
            {data.week.active_days} of {data.week.goal} days
          </AppText>
        </View>
      )}

      <View style={styles.stats}>
        <Stat label="Active time" value={formatDuration(minutes * 60)} />
        <Stat label="Workouts" value={String(data.workouts.length)} />
        <Stat label="Active days" value={String(data.week?.active_days ?? 0)} />
      </View>

      <Card>
        {days.map((day) => (
          <View key={day.key} style={styles.day}>
            <AppText variant="label">
              {day.date.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </AppText>
            {day.workouts.length === 0 ? (
              <AppText variant="caption" color={Colors.textMuted}>
                No workouts
              </AppText>
            ) : (
              day.workouts.map((w) => (
                <Link key={w.id} href={{ pathname: '/workout/[id]', params: { id: w.id } }} asChild>
                  <Pressable>
                    <WorkoutRow workout={w} />
                  </Pressable>
                </Link>
              ))
            )}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <AppText variant="caption" style={{ fontSize: 11 }}>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  status: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: { flex: 1, padding: Spacing.sm + 4, gap: 2 },
  day: { gap: Spacing.xs, paddingVertical: Spacing.xs },
});
