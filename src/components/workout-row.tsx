import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Workout } from '@/lib/database.types';
import { useEvidenceUrls } from '@/lib/evidence';
import { evidenceBadges } from '@/lib/evidence-badges';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';
import { workoutXp } from '@/lib/workout-xp';

/**
 * One of your workouts. With `showXp` (Home), it also shows the XP it earned
 * and, when a photo or a partner's ✅ would add more, what it could reach.
 * A workout with photos shows the first one in place of its icon.
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
  const { data: urls } = useEvidenceUrls(workout.photo_paths);
  const photo = workout.photo_paths[0] ? urls?.[workout.photo_paths[0]] : undefined;
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
        {photo ? (
          <>
            <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            {workout.photo_paths.length > 1 && (
              <View style={styles.morePhotos}>
                <AppText style={styles.morePhotosText}>+{workout.photo_paths.length - 1}</AppText>
              </View>
            )}
          </>
        ) : (
          <SymbolView name={workoutIcon(workout.activity_type)} size={22} tintColor={Colors.flame} />
        )}
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
            style={styles.xpCol}
            accessible
            accessibilityLabel={`Earned ${xp.earned} XP${more ? `, up to ${xp.potential}` : ''}`}>
            <View style={styles.xp}>
              <SymbolView name="bolt.fill" size={14} tintColor={Colors.xp} />
              <AppText style={styles.xpText}>{xp.earned}</AppText>
              <AppText style={styles.xpUnit}>XP</AppText>
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
  xpCol: { alignItems: 'flex-end', gap: 2 },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.xpSoft,
  },
  xpText: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: Colors.text, fontVariant: ['tabular-nums'] },
  xpUnit: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  more: { fontSize: 12, color: Colors.textMuted },
  morePhotos: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  morePhotosText: { color: '#fff', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: Colors.flameSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
