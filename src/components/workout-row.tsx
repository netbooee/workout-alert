import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Workout } from '@/lib/database.types';
import { evidenceBadges } from '@/lib/evidence-badges';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';

export function WorkoutRow({ workout }: { workout: Workout }) {
  const started = new Date(workout.started_at);
  const stats = [
    formatDuration(workout.duration_s),
    workout.active_kcal != null ? `${Math.round(workout.active_kcal)} kcal` : null,
    workout.avg_hr != null ? `${Math.round(workout.avg_hr)} bpm` : null,
  ].filter(Boolean);
  const verifiedBy = evidenceBadges(workout)[0]!;

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <SymbolView name={workoutIcon(workout.activity_type)} size={22} tintColor={Colors.flame} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{workoutLabel(workout.activity_type)}</AppText>
        <AppText variant="caption" numberOfLines={1}>
          {stats.join(' · ')}
        </AppText>
        <View style={styles.evidence}>
          <SymbolView name={verifiedBy.icon} size={10} tintColor={Colors.textMuted} />
          <AppText variant="caption" numberOfLines={1} style={{ fontSize: 11, color: Colors.textMuted }}>
            {verifiedBy.label}
            {workout.photo_paths.length > 0 && verifiedBy.icon !== 'camera.fill' ? ' · 📷' : ''}
          </AppText>
        </View>
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
  evidence: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
