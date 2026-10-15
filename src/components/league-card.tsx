import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { LeagueRow } from '@/lib/database.types';

const MEDALS = ['🥇', '🥈', '🥉'];

function daysLeftInWeek(now = new Date()) {
  return 7 - ((now.getDay() + 6) % 7);
}

export function LeagueCard({ rows }: { rows: LeagueRow[] }) {
  const left = daysLeftInWeek();
  return (
    <Card>
      <View style={styles.header}>
        <AppText variant="label">This week’s league</AppText>
        <AppText variant="caption">
          {left} day{left === 1 ? '' : 's'} left
        </AppText>
      </View>
      {rows.map((r, i) => (
        <View key={r.user_id} style={[styles.row, r.is_me && styles.me]}>
          <AppText variant="heading" style={styles.rank}>
            {r.xp > 0 && MEDALS[i] ? MEDALS[i] : i + 1}
          </AppText>
          <Avatar id={r.user_id} name={r.display_name} size={32} />
          <AppText variant="heading" style={{ flex: 1 }}>
            {r.is_me ? 'You' : (r.display_name ?? 'Partner')}
          </AppText>
          <AppText variant="heading" color={Colors.xp}>
            {r.xp} XP
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  me: { backgroundColor: Colors.cardRaised },
  rank: { width: 28, textAlign: 'center' },
});
