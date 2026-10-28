import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import type { Streak } from '@/lib/database.types';
import { levelFor } from '@/lib/levels';
import { todayLine, todayTone, type TodayTone } from '@/lib/today-line';
import type { WeekState } from '@/lib/week';

export function StreakHero({
  streak,
  state,
  resting = false,
  xp,
  league,
  showChevron = false,
  workedOutToday = false,
  action,
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
  /** A workout that counts already happened today (changes what the sentence says). */
  workedOutToday?: boolean;
  /** Rendered under the sentence, e.g. Home's Log button. */
  action?: ReactNode;
  /** Rendered between the streak and the status line (Home puts the week dots here). */
  children?: ReactNode;
}) {
  const weeks = streak?.current_weeks ?? 0;
  const lit = weeks > 0 || state.kind === 'done';
  const facts = { state, weeks, freezes: streak?.freezes_banked ?? 0, workedOutToday, resting };
  const tone = todayTone(facts);

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
      {/* One plain sentence about today, after Alma's "Track one item to keep your streak". */}
      <View style={[styles.tip, tone === 'urgent' && styles.urgentTip]}>
        <SymbolView
          name={tone === 'rest' ? 'moon.zzz.fill' : tone === 'done' ? 'checkmark.circle.fill' : 'flame.fill'}
          size={22}
          tintColor={tone === 'calm' ? Colors.flame : TONE_COLOR[tone]}
        />
        <AppText variant="heading" color={TONE_COLOR[tone]} style={{ flex: 1 }}>
          {todayLine(facts)}
        </AppText>
      </View>
      {action}
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

const TONE_COLOR: Record<TodayTone, ColorValue> = {
  done: Colors.success,
  urgent: Colors.flame,
  calm: Colors.text,
  rest: Colors.rest,
};

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
  urgentTip: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
});
