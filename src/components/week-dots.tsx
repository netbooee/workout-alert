import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import type { WeekDay } from '@/lib/week';

/** Runs of back-to-back workout days, as [first, last] column indexes. */
function runs(days: readonly WeekDay[]): [number, number][] {
  const out: [number, number][] = [];
  days.forEach((d, i) => {
    if (!d.active) return;
    const prev = out[out.length - 1];
    if (prev && prev[1] === i - 1) prev[1] = i;
    else out.push([i, i]);
  });
  return out;
}

const span = (first: number, last: number) =>
  ({ left: `${(first / 7) * 100}%`, width: `${((last - first + 1) / 7) * 100}%` }) as const;

/**
 * This week as one row of the streak calendar: workout days join into orange
 * pills, today is ringed, and the row gets the goal-week band once the goal is hit.
 */
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
    <Container style={styles.container}>
      <View style={styles.header}>
        <AppText variant="label">This week</AppText>
        <AppText variant="heading">
          {active}
          <AppText variant="caption"> / {goal} days</AppText>
        </AppText>
      </View>
      <View style={styles.row}>
        {days.map((d) => (
          <AppText key={d.key} variant="caption" style={styles.weekday}>
            {d.label}
          </AppText>
        ))}
      </View>
      <View style={[styles.row, styles.days]}>
        {active >= goal && <View style={[styles.band, span(0, 6)]} />}
        {runs(days).map(([a, b]) => (
          <View key={a} style={[styles.run, span(a, b)]} />
        ))}
        {days.map((d) => (
          <View key={d.key} style={styles.cell}>
            <View style={[styles.dot, d.isToday && styles.today]}>
              <AppText
                style={[
                  styles.dayText,
                  { color: d.active ? '#fff' : d.isFuture ? Colors.textMuted : Colors.text },
                ]}>
                {Number(d.key.slice(8))}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </Container>
  );
}

const ROW = 42;

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', alignItems: 'center' },
  weekday: { flex: 1, textAlign: 'center', fontWeight: '700' },
  days: { height: ROW },
  band: { position: 'absolute', top: 1, bottom: 1, borderRadius: ROW / 2, backgroundColor: Colors.flameSoft },
  run: { position: 'absolute', top: 4, bottom: 4, borderRadius: ROW / 2, backgroundColor: Colors.flame },
  cell: { flex: 1, height: ROW, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: Colors.text },
  dayText: { fontFamily: Font.rounded, fontSize: 16, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
