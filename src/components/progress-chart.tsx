import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Segmented } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useProgressWorkouts } from '@/hooks/use-home-data';
import {
  metricValue,
  niceMax,
  PROGRESS_RANGES,
  weekRangeLabel,
  weeklyAverage,
  weeklyTotals,
  type ProgressMetric,
  type ProgressRange,
} from '@/lib/progress';
import { formatDuration } from '@/lib/workout-types';

const CHART_HEIGHT = 140;
const DASHES = Array.from({ length: 40 }, (_, i) => i);
const METRICS: { key: ProgressMetric; label: string }[] = [
  { key: 'minutes', label: 'Minutes' },
  { key: 'workouts', label: 'Workouts' },
];

const format = (value: number, metric: ProgressMetric) =>
  metric === 'minutes' ? formatDuration(value * 60) : `${Math.round(value * 10) / 10}`;

const withUnit = (value: number, metric: ProgressMetric) =>
  metric === 'minutes'
    ? format(value, metric)
    : `${format(value, metric)} ${value === 1 ? 'workout' : 'workouts'}`;

/** Weekly active minutes or workout count, with a dashed average line. Tap a bar for that week. */
export function ProgressChart() {
  const { data: workouts } = useProgressWorkouts();
  const [metric, setMetric] = useState<ProgressMetric>('minutes');
  const [range, setRange] = useState<ProgressRange>('12w');
  const weeks = PROGRESS_RANGES.find((r) => r.key === range)!.weeks;

  const totals = useMemo(() => weeklyTotals(workouts ?? [], weeks), [workouts, weeks]);
  const average = weeklyAverage(totals, metric);
  const max = niceMax(Math.max(average, ...totals.map((t) => metricValue(t, metric))));
  const total = totals.reduce((sum, t) => sum + metricValue(t, metric), 0);
  const gap = weeks <= 12 ? 6 : weeks <= 26 ? 3 : 1.5;

  return (
    <Card>
      <View style={styles.header}>
        <AppText variant="label">Progress</AppText>
        <Segmented options={METRICS} value={metric} onChange={(m) => setMetric(m)} />
      </View>

      <View style={styles.summary}>
        <View>
          <AppText variant="title">{withUnit(total, metric)}</AppText>
          <AppText variant="caption">in the last {weeks} weeks</AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="heading" color={Colors.flame}>
            {withUnit(average, metric)}
          </AppText>
          <AppText variant="caption">weekly average</AppText>
        </View>
      </View>

      <View style={styles.chart}>
        <AppText variant="caption" style={styles.axisMax}>
          {format(max, metric)}
        </AppText>
        <View style={[styles.bars, { gap }]}>
          {totals.map((t) => {
            const value = metricValue(t, metric);
            return (
              <Pressable
                key={t.weekStart}
                style={styles.barSlot}
                accessibilityRole="button"
                accessibilityLabel={`${weekRangeLabel(t.weekStart)}: ${withUnit(value, metric)}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: '/week/[start]',
                    params: { start: t.weekStart },
                  });
                }}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: value > 0 ? Math.max(4, (value / max) * CHART_HEIGHT) : 2,
                      backgroundColor:
                        value === 0
                          ? Colors.cardRaised
                          : t.isCurrent
                            ? Colors.flameSoft
                            : Colors.flame,
                      borderColor: t.isCurrent && value > 0 ? Colors.flame : 'transparent',
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        {average > 0 && (
          <View
            pointerEvents="none"
            style={[styles.average, { bottom: (average / max) * CHART_HEIGHT }]}>
            {DASHES.map((i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.axis}>
        <AppText variant="caption" style={styles.axisLabel}>
          {weekRangeLabel(totals[0]!.weekStart).split(' – ')[0]}
        </AppText>
        <AppText variant="caption" style={styles.axisLabel}>
          This week
        </AppText>
      </View>

      <View style={styles.ranges}>
        <Segmented
          options={PROGRESS_RANGES.map((r) => ({ key: r.key, label: r.label }))}
          value={range}
          onChange={(r) => setRange(r)}
        />
        <AppText variant="caption" style={{ fontSize: 11 }}>
          Tap a bar for that week
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chart: {
    height: CHART_HEIGHT,
    marginTop: Spacing.lg,
    justifyContent: 'flex-end',
  },
  axisMax: { position: 'absolute', top: -Spacing.md, right: 0, fontSize: 10 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 3, borderWidth: 1 },
  // A row of dashes: iOS doesn't draw a dashed border on a single side.
  average: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  dash: { width: 4, height: 1, backgroundColor: Colors.textSecondary },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 11 },
  ranges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
