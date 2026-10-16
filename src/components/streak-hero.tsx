import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Streak } from '@/lib/database.types';
import type { WeekState } from '@/lib/week';

export function StreakHero({
  streak,
  state,
  resting = false,
  children,
}: {
  streak: Streak | null;
  state: WeekState;
  resting?: boolean;
  /** Rendered between the streak and the status line (Home puts the week dots here). */
  children?: ReactNode;
}) {
  const weeks = streak?.current_weeks ?? 0;
  const lit = weeks > 0 || state.kind === 'done';

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.flame, { backgroundColor: lit ? Colors.flameSoft : Colors.cardRaised }]}>
          <SymbolView
            name="flame.fill"
            size={38}
            tintColor={lit ? Colors.flame : Colors.textMuted}
            animationSpec={lit ? { effect: { type: 'bounce' } } : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="display">{weeks}</AppText>
          <AppText variant="caption">week streak</AppText>
        </View>
        <FreezeChips count={streak?.freezes_banked ?? 0} />
      </View>
      {children}
      <AppText variant="body" color={resting ? Colors.rest : messageColor(state)}>
        {resting ? 'Rest mode is on. Your streak is protected 😴' : message(state, weeks)}
      </AppText>
    </Card>
  );
}

function FreezeChips({ count }: { count: number }) {
  return (
    <View style={styles.freezes}>
      {[0, 1].map((i) => (
        <SymbolView
          key={i}
          name="snowflake"
          size={18}
          tintColor={i < count ? Colors.freeze : Colors.textMuted}
        />
      ))}
      <AppText variant="caption" style={{ fontSize: 11 }}>
        {count} freeze{count === 1 ? '' : 's'}
      </AppText>
    </View>
  );
}

function message(state: WeekState, weeks: number): string {
  const days = (n: number) => `${n} more day${n === 1 ? '' : 's'}`;
  switch (state.kind) {
    case 'done':
      return 'Goal hit this week. Streak secured 🔥';
    case 'on-track':
      return `${days(state.needed)} to go · ${state.daysLeft} days left this week`;
    case 'at-risk':
      return weeks > 0
        ? `Streak at risk: ${days(state.needed)} needed with ${state.daysLeft} left`
        : `${days(state.needed)} needed with ${state.daysLeft} left`;
    case 'out-of-reach':
      return weeks > 0
        ? 'This week is out of reach. A freeze will cover it if you have one.'
        : 'Fresh start on Sunday. Any workout still counts toward your history.';
  }
}

function messageColor(state: WeekState): ColorValue {
  switch (state.kind) {
    case 'done':
      return Colors.success;
    case 'at-risk':
      return Colors.flame;
    default:
      return Colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md + 4, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flame: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezes: { alignItems: 'center', gap: 2 },
});
