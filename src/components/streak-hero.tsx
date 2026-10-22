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
  league,
  showChevron = false,
  children,
}: {
  streak: Streak | null;
  state: WeekState;
  resting?: boolean;
  /** Your total XP, shown as a square on the right that opens How XP works. */
  xp?: number;
  /** Your public league this week (opens Leagues), or `joined: false` for an invitation. */
  league?: { joined: boolean; emoji: string; name: string; rank?: number; size?: number };
  /** Hints that the card opens the streak screen. */
  showChevron?: boolean;
  /** Rendered between the streak and the status line (Home puts the week dots here). */
  children?: ReactNode;
}) {
  const weeks = streak?.current_weeks ?? 0;
  const lit = weeks > 0 || state.kind === 'done';

  // Same look as the streak screen (Duolingo-style), at Home size.
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.number, !lit && { color: Colors.textMuted }]}>{weeks}</AppText>
          <AppText style={[styles.label, !lit && { color: Colors.textMuted }]}>
            week streak{lit ? '!' : ''}
          </AppText>
        </View>
        <View style={[styles.flame, { backgroundColor: lit ? Colors.flameSoft : Colors.cardRaised }]}>
          <SymbolView
            name="flame.fill"
            size={52}
            tintColor={lit ? Colors.flame : Colors.textMuted}
            animationSpec={lit ? { effect: { type: 'bounce' } } : undefined}
          />
        </View>
        {showChevron && <SymbolView name="chevron.right" size={14} tintColor={Colors.textMuted} />}
      </View>
      {(xp != null || league) && (
        <View style={styles.chips}>
          {xp != null && <XpChip xp={xp} />}
          {league && <LeagueChip {...league} />}
        </View>
      )}
      {children}
      <View style={styles.tip}>
        <SymbolView
          name={resting ? 'moon.zzz.fill' : 'flame.fill'}
          size={20}
          tintColor={resting ? Colors.rest : state.kind === 'done' ? Colors.success : Colors.flame}
        />
        <AppText variant="body" color={resting ? Colors.rest : messageColor(state)} style={{ flex: 1 }}>
          {resting
            ? 'Rest mode is on. Your streak is protected 😴'
            : message(state, weeks, streak?.freezes_banked ?? 0)}
        </AppText>
      </View>
    </Card>
  );
}

function LeagueChip({ joined, emoji, name, rank, size }: NonNullable<Parameters<typeof StreakHero>[0]['league']>) {
  const label = !joined
    ? '🏆 Join a league'
    : `${emoji} ${name}${rank ? ` · #${rank}${size && size > 1 ? ` of ${size}` : ''}` : ''}`;
  return (
    <Pressable
      onPress={() => router.push('/league')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={joined ? `${name} League${rank ? `, place ${rank}` : ''}` : 'Join a public league'}
      style={({ pressed }) => [styles.chip, styles.leagueChip, pressed && { opacity: 0.7 }]}>
      <AppText variant="caption" color={Colors.text} numberOfLines={1} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );
}

function XpChip({ xp }: { xp: number }) {
  const info = levelFor(xp);
  return (
    <Pressable
      onPress={() => router.push('/xp')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${xp} XP, level ${info.level}, ${info.title}`}
      accessibilityHint="Shows how XP works"
      style={({ pressed }) => [styles.chip, styles.xpChip, pressed && { opacity: 0.7 }]}>
      <AppText variant="caption" color={Colors.text} style={styles.chipText}>
        ⚡ {xp.toLocaleString()} XP · Level {info.level}
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
  number: {
    fontFamily: Font.rounded,
    fontSize: 60,
    lineHeight: 66,
    fontWeight: '900',
    color: Colors.flame,
    fontVariant: ['tabular-nums'],
  },
  label: { fontFamily: Font.rounded, fontSize: 19, lineHeight: 24, fontWeight: '800', color: Colors.flame, marginTop: -4 },
  flame: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  xpChip: { backgroundColor: Colors.xpSoft },
  leagueChip: { backgroundColor: Colors.flameSoft },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 4,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
});
