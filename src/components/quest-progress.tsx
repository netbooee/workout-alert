import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { Incentive } from '@/lib/database.types';
import { goalOption, progressFraction, remainingText, timeLeft, usesPips } from '@/lib/incentives';

/**
 * Progress on an active incentive, Duolingo "Friends Quest" style: the count,
 * one pip per day or workout (a bar for minutes), and what's left with the
 * days remaining. `who` names the person working on it, for the giver's view.
 */
export function QuestProgress({ incentive: i, who }: { incentive: Incentive; who?: string }) {
  const left = remainingText(i);
  const reached = i.progress >= i.goal_target;
  return (
    <View style={styles.container}>
      <View style={styles.countRow}>
        <AppText variant="title">
          {Math.min(i.progress, i.goal_target)}
          <AppText variant="caption">
            {' '}
            / {i.goal_target} {goalOption(i.goal_kind).unit}
          </AppText>
        </AppText>
        <AppText variant="caption">{timeLeft(i.ends_at)}</AppText>
      </View>
      {usesPips(i) ? (
        <View style={styles.pips} accessibilityLabel={`${i.progress} of ${i.goal_target}`}>
          {Array.from({ length: i.goal_target }, (_, n) => (
            <View key={n} style={[styles.pip, n < i.progress && styles.pipDone]} />
          ))}
        </View>
      ) : (
        <View style={styles.track} accessibilityLabel={`${i.progress} of ${i.goal_target}`}>
          <View style={[styles.fill, { width: `${progressFraction(i) * 100}%` }]} />
        </View>
      )}
      <AppText variant="body" color={reached ? Colors.success : Colors.textSecondary}>
        {reached ? 'Goal reached 🎉' : who ? `${who} needs ${left}` : `${left} to go`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised },
  pipDone: { backgroundColor: Colors.flame },
  track: { height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: Colors.flame },
});
