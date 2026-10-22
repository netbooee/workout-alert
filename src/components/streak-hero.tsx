import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import type { Streak } from '@/lib/database.types';
import { levelFor } from '@/lib/levels';
import type { WeekState } from '@/lib/week';

export function StreakHero({
  streak,
  state,
  resting = false,
  xp,
  showChevron = false,
  children,
}: {
  streak: Streak | null;
  state: WeekState;
  resting?: boolean;
  /** Your total XP, shown as a square on the right that opens How XP works. */
  xp?: number;
  /** Hints that the card opens the streak screen. */
  showChevron?: boolean;
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
        {xp != null && <XpSquare xp={xp} />}
        {showChevron && <SymbolView name="chevron.right" size={14} tintColor={Colors.textMuted} />}
      </View>
      {children}
      <AppText variant="body" color={resting ? Colors.rest : messageColor(state)}>
        {resting
          ? 'Rest mode is on. Your streak is protected 😴'
          : message(state, weeks, streak?.freezes_banked ?? 0)}
      </AppText>
    </Card>
  );
}

function XpSquare({ xp }: { xp: number }) {
  const info = levelFor(xp);
  return (
    <Pressable
      onPress={() => router.push('/xp')}
      accessibilityRole="button"
      accessibilityLabel={`${xp} XP, level ${info.level}, ${info.title}`}
      accessibilityHint="Shows how XP works"
      style={({ pressed }) => [styles.xp, pressed && { opacity: 0.7 }]}>
      <View style={styles.xpTop}>
        <SymbolView name="bolt.fill" size={14} tintColor={Colors.xp} />
        <AppText variant="caption" color={Colors.text} style={styles.xpUnit}>
          XP
        </AppText>
      </View>
      <AppText style={styles.xpNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {xp.toLocaleString()}
      </AppText>
      <AppText variant="caption" style={{ fontSize: 11, lineHeight: 14 }}>
        Level {info.level}
      </AppText>
    </Pressable>
  );
}

function message(state: WeekState, weeks: number, freezes: number): string {
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
      if (weeks === 0) return 'Fresh start on Sunday. Any workout still counts toward your history.';
      return freezes > 0
        ? 'This week is out of reach, but a freeze will cover it ❄️'
        : 'This week is out of reach. Hit next week’s goal to start a new streak.';
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
  xp: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingHorizontal: 6,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Colors.xp,
    backgroundColor: Colors.xpSoft,
  },
  xpTop: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  xpUnit: { fontSize: 12, lineHeight: 15, fontWeight: '800' },
  xpNumber: {
    fontFamily: Font.rounded,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
});
