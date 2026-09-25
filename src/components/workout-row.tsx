import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Workout } from '@/lib/database.types';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';

export function WorkoutRow({ workout }: { workout: Workout }) {
  const started = new Date(workout.started_at);
  const stats = [
    formatDuration(workout.duration_s),
    workout.active_kcal != null ? `${Math.round(workout.active_kcal)} kcal` : null,
    workout.avg_hr != null ? `${Math.round(workout.avg_hr)} bpm avg` : null,
  ].filter(Boolean);

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <SymbolView name={workoutIcon(workout.activity_type)} size={22} tintColor={Colors.flame} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{workoutLabel(workout.activity_type)}</AppText>
        <AppText variant="caption">{stats.join(' · ')}</AppText>
      </View>
      <AppText variant="caption">
        {started.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
        {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    backgroundColor: Colors.flameSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
