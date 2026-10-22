import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ReactionBar } from '@/components/reaction-bar';
import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useCheerQueue, useNames } from '@/hooks/use-social';
import { whenLabel } from '@/lib/cheers';
import { formatDuration, workoutLabel } from '@/lib/workout-types';

/**
 * Partners' recent workouts still waiting for your cheer, with Cheer and Verify
 * right on each row. A row leaves the list as soon as you react.
 */
export function CheerCard({ max = 3 }: { max?: number }) {
  const queue = useCheerQueue();
  const nameOf = useNames();
  if (!queue.length) return null;
  const shown = queue.slice(0, max);
  const more = queue.length - shown.length;

  return (
    <Card style={styles.card}>
      <AppText variant="label">Cheer on your partners</AppText>
      {shown.map(({ workout: w, reactions }) => (
        <View key={w.id} style={styles.item}>
          <Link href={{ pathname: '/workout/[id]', params: { id: w.id } }} asChild>
            <Pressable style={styles.row} accessibilityRole="button">
              <Avatar id={w.user_id} name={nameOf(w.user_id)} size={36} />
              <View style={{ flex: 1 }}>
                <AppText variant="heading" numberOfLines={1}>
                  {nameOf(w.user_id).split(' ')[0]} · {workoutLabel(w.activity_type)} {formatDuration(w.duration_s)}
                </AppText>
                <AppText variant="caption">
                  {whenLabel(w.started_at)}
                  {w.photo_paths.length ? ' · 📷' : ''}
                </AppText>
              </View>
            </Pressable>
          </Link>
          <ReactionBar workoutId={w.id} ownerId={w.user_id} reactions={reactions} compact />
        </View>
      ))}
      {more > 0 && (
        <Link href="/partners" asChild>
          <Pressable hitSlop={8}>
            <AppText variant="caption" color={Colors.flame}>
              {more} more on the Partners tab
            </AppText>
          </Pressable>
        </Link>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, borderColor: Colors.flame },
  item: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
