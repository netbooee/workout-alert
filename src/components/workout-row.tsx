import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Workout } from '@/lib/database.types';
import { evidenceBadges } from '@/lib/evidence-badges';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';
import { workoutXp } from '@/lib/workout-xp';

/**
 * One of your workouts. With `showXp` (Home), it also shows the XP it earned
 * and, when a photo or a partner's ✅ would add more, what it could reach.
 */
export function WorkoutRow({
  workout,
  showXp = false,
  verified = false,
}: {
  workout: Workout;
  showXp?: boolean;
  verified?: boolean;
}) {
  const started = new Date(workout.started_at);
  const stats = [
    formatDuration(workout.duration_s),
    workout.active_kcal != null ? `${Math.round(workout.active_kcal)} kcal` : null,
    workout.avg_hr != null ? `${Math.round(workout.avg_hr)} bpm` : null,
  ].filter(Boolean);
  const verifiedBy = evidenceBadges(workout)[0]!;
  const xp = workoutXp({
    durationS: workout.duration_s,
    counted: workout.counted,
    hasPhoto: workout.photo_paths.length > 0,
    verified,
  });
  const more = [xp.photoLeft ? `📸 +${xp.photoLeft}` : null, xp.verifyLeft ? `✅ +${xp.verifyLeft}` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={[styles.row, !workout.counted && styles.uncounted]}>
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
            {workout.counted ? '' : ' · Didn’t count'}
          </AppText>
        </View>
      </View>
      <View style={styles.side}>
        <AppText variant="caption">
          {started.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
          {started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </AppText>
        {showXp && workout.counted && (
          <View
            style={styles.xpRow}
            accessible
            accessibilityLabel={`Earned ${xp.earned} XP${more ? `, up to ${xp.potential}` : ''}`}>
            <View style={styles.xp}>
              <AppText variant="caption" color={Colors.text} style={styles.xpText}>
                ⚡ {xp.earned}
              </AppText>
            </View>
            {more ? (
              <AppText variant="caption" style={styles.more}>
                {more}
              </AppText>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  evidence: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  uncounted: { opacity: 0.5 },
  side: { alignItems: 'flex-end', gap: 4 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  xp: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill, backgroundColor: Colors.xpSoft },
  xpText: { fontSize: 11, fontWeight: '700' },
  more: { fontSize: 11, color: Colors.textMuted },
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
