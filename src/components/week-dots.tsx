import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { WeekDay } from '@/lib/week';

export function WeekDots({
  days,
  goal,
  embedded = false,
}: {
  days: WeekDay[];
  goal: number;
  /** Render inside another card (the streak card on Home) instead of in its own. */
  embedded?: boolean;
}) {
  const active = days.filter((d) => d.active).length;
  const Container = embedded ? View : Card;
  return (
    <Container style={embedded ? styles.embedded : undefined}>
      <View style={styles.header}>
        <AppText variant="label">This week</AppText>
        <AppText variant="heading">
          {active}
          <AppText variant="caption"> / {goal} days</AppText>
        </AppText>
      </View>
      <View style={styles.row}>
        {days.map((d) => (
          <View key={d.key} style={styles.day}>
            <View
              style={[
                styles.dot,
                d.active && styles.dotActive,
                d.isToday && !d.active && styles.dotToday,
                d.isFuture && styles.dotFuture,
              ]}>
              {d.active && <SymbolView name="checkmark" size={14} weight="bold" tintColor="#000" />}
            </View>
            <AppText variant="caption" color={d.isToday ? Colors.text : Colors.textSecondary}>
              {d.label}
            </AppText>
          </View>
        ))}
      </View>
    </Container>
  );
}

const DOT = 34;

const styles = StyleSheet.create({
  embedded: { gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.xs },
  day: { alignItems: 'center', gap: 6 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: Colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: Colors.flame },
  dotToday: { borderWidth: 2, borderColor: Colors.flame },
  dotFuture: { opacity: 0.5 },
});
