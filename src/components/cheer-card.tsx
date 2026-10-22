import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ReactionBar } from '@/components/reaction-bar';
import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useCheerQueue, useNames } from '@/hooks/use-social';
import { dismissCheerRow, keepCheerRows } from '@/lib/cheer-list-store';
import { whenLabel } from '@/lib/cheers';
import { formatDuration, workoutLabel } from '@/lib/workout-types';

/**
 * Partners' recent workouts still waiting on you, with Cheer and Verify right
 * on each row. A row stays after a cheer (so you can still verify) and leaves
 * when you verify it or dismiss it with ✕.
 */
export function CheerCard({ max = 3 }: { max?: number }) {
  const queue = useCheerQueue();
  const nameOf = useNames();
  const shown = queue.slice(0, max);
  const more = queue.length - shown.length;
  const shownIds = shown.map((i) => i.workout.id).join(',');

  // Whatever is on screen stays put after a cheer, until you verify or dismiss it.
  useEffect(() => {
    if (shownIds) keepCheerRows(shownIds.split(','));
  }, [shownIds]);

  if (!queue.length) return null;

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
          <Pressable
            onPress={() => dismissCheerRow(w.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${nameOf(w.user_id).split(' ')[0]}’s workout`}
            style={styles.dismiss}>
            <SymbolView name="xmark" size={14} weight="semibold" tintColor={Colors.textMuted} />
          </Pressable>
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
  dismiss: { position: 'absolute', top: 0, right: 0, padding: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingRight: 28 },
});
