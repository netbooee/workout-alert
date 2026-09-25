import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { StreakWeek } from '@/lib/database.types';

const STATUS_COLOR: Record<StreakWeek['status'], string> = {
  hit: Colors.flame,
  frozen: Colors.freeze,
  missed: Colors.cardRaised,
  in_progress: Colors.textMuted,
};

export function StreakHistory({ weeks }: { weeks: StreakWeek[] }) {
  return (
    <Card>
      <AppText variant="label">Last {weeks.length || 12} weeks</AppText>
      {weeks.length === 0 ? (
        <AppText variant="caption">Your weekly history will show up after your first workout.</AppText>
      ) : (
        <>
          <View style={styles.bars}>
            {weeks.map((w) => (
              <View key={w.week_start} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: 12 + 44 * Math.min(w.active_days / Math.max(w.goal, 1), 1),
                      backgroundColor: STATUS_COLOR[w.status],
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <Legend color={Colors.flame} label="Hit" />
            <Legend color={Colors.freeze} label="Frozen" />
            <Legend color={Colors.cardRaised} label="Missed" />
            <Legend color={Colors.textMuted} label="This week" />
          </View>
        </>
      )}
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 60, marginTop: Spacing.sm },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 4 },
  legend: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
