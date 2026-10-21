import { StyleSheet, View, type ColorValue } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { Incentive } from '@/lib/database.types';
import { goalOption, progressFraction, remainingText, timeLeft, usesPips } from '@/lib/incentives';

/**
 * Progress on an active incentive, Duolingo "Friends Quest" style: the count,
 * one pip per day or workout (a bar for minutes), and what's left with the
 * days remaining. `who` names the person working on it, for the giver's view.
 * A shared quest splits the pips by person: yours first, then your partner's.
 */
export function QuestProgress({
  incentive: i,
  who,
  split,
}: {
  incentive: Incentive;
  who?: string;
  /** Shared quests: your share, your partner's share, and their first name. */
  split?: { mine: number; theirs: number; otherName: string };
}) {
  const left = remainingText(i) + (i.shared ? ' between you' : '');
  const reached = i.progress >= i.goal_target;
  const unit = goalOption(i.goal_kind).unit;
  return (
    <View style={styles.container}>
      <View style={styles.countRow}>
        <AppText variant="title">
          {Math.min(i.progress, i.goal_target)}
          <AppText variant="caption">
            {' '}
            / {i.goal_target} {unit}
          </AppText>
        </AppText>
        <AppText variant="caption">{timeLeft(i.ends_at)}</AppText>
      </View>
      {usesPips(i) ? (
        <View style={styles.pips} accessibilityLabel={`${i.progress} of ${i.goal_target}`}>
          {Array.from({ length: i.goal_target }, (_, n) => (
            <View
              key={n}
              style={[
                styles.pip,
                n < (split ? split.mine : i.progress) && styles.pipDone,
                split && n >= split.mine && n < split.mine + split.theirs && styles.pipTheirs,
              ]}
            />
          ))}
        </View>
      ) : (
        <View style={styles.track} accessibilityLabel={`${i.progress} of ${i.goal_target}`}>
          <View style={[styles.fill, { width: `${progressFraction(i) * 100}%` }]} />
        </View>
      )}
      {split && (
        <View style={styles.legend}>
          <Legend color={Colors.flame} label={`You · ${split.mine}`} />
          <Legend color={Colors.xp} label={`${split.otherName} · ${split.theirs}`} />
        </View>
      )}
      <AppText variant="body" color={reached ? Colors.success : Colors.textSecondary}>
        {reached ? 'Goal reached 🎉' : who && !i.shared ? `${who} needs ${left}` : `${left} to go`}
      </AppText>
    </View>
  );
}

function Legend({ color, label }: { color: ColorValue; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised },
  pipDone: { backgroundColor: Colors.flame },
  pipTheirs: { backgroundColor: Colors.xp },
  legend: { flexDirection: 'row', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: Colors.flame },
});
