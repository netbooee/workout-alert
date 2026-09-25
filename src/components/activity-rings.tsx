import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { AppText, Card } from '@/components/ui';
import { Colors, DailyTargets, Spacing } from '@/constants/theme';
import type { DailyActivity } from '@/lib/database.types';

const SIZE = 112;
const STROKE = 12;
const GAP = 3;

export function ActivityRings({ today }: { today: DailyActivity | null }) {
  const rings = [
    {
      label: 'Move',
      color: Colors.ringMove,
      value: today?.active_kcal ?? 0,
      target: DailyTargets.activeKcal,
      unit: 'kcal',
    },
    {
      label: 'Exercise',
      color: Colors.ringExercise,
      value: today?.exercise_min ?? 0,
      target: DailyTargets.exerciseMin,
      unit: 'min',
    },
    {
      label: 'Steps',
      color: Colors.ringSteps,
      value: today?.steps ?? 0,
      target: DailyTargets.steps,
      unit: '',
    },
  ];

  return (
    <Card style={styles.card}>
      <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
        {rings.map((r, i) => {
          const radius = SIZE / 2 - STROKE / 2 - i * (STROKE + GAP);
          const circumference = 2 * Math.PI * radius;
          const progress = Math.min(r.value / r.target, 1);
          return (
            <G key={r.label}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={radius}
                stroke={r.color}
                strokeOpacity={0.2}
                strokeWidth={STROKE}
                fill="none"
              />
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={radius}
                stroke={r.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - progress)}
                fill="none"
              />
            </G>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <AppText variant="label">Today</AppText>
        {rings.map((r) => (
          <View key={r.label}>
            <AppText variant="caption" color={r.color}>
              {r.label}
            </AppText>
            <AppText variant="heading">
              {Math.round(r.value).toLocaleString()}
              <AppText variant="caption">
                {' '}
                / {r.target.toLocaleString()} {r.unit}
              </AppText>
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  legend: { flex: 1, gap: 6 },
});
