import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useStreakMonth } from '@/hooks/use-home-data';
import { monthGrid, monthSpan, monthStats, workoutRuns, type WeekStatus } from '@/lib/streak-calendar';
import { dayKey } from '@/lib/week';
import { formatDuration, workoutLabel } from '@/lib/workout-types';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
/** How far back the arrows go. */
const MONTHS_BACK = 12;

/** The band behind a week: its streak status, Duolingo-style. */
const BAND: Partial<Record<WeekStatus, { fill: ColorValue; label: string }>> = {
  hit: { fill: Colors.flameSoft, label: 'Goal week' },
  frozen: { fill: Colors.freezeSoft, label: 'Frozen' },
  rest: { fill: 'rgba(139, 150, 233, 0.18)', label: 'Rest' },
};

const WEEK_LINE: Record<WeekStatus, string> = {
  hit: 'Goal hit 🔥',
  frozen: 'Covered by a freeze ❄️',
  missed: 'Goal missed',
  in_progress: 'In progress',
  rest: 'Rest week 😴',
};

/**
 * A month of your streak: totals (days, XP, freezes), a calendar where workout
 * days join into orange pills over each week's status band, and the XP and
 * workouts of the day you tap.
 */
export function StreakCalendar() {
  const [now] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  const shown = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const [picked, setPicked] = useState<string | null>(null);
  const { data, isPending } = useStreakMonth(year, month);

  const worked = new Set((data?.workouts ?? []).filter((w) => w.counted).map((w) => dayKey(new Date(w.started_at))));
  const status = new Map((data?.weeks ?? []).map((w) => [w.week_start, w.status] as const));
  const weeks = monthGrid(year, month, worked, status, now);
  const stats = monthStats(weeks);
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthXp = Object.entries(data?.xpByDay ?? {})
    .filter(([k]) => k.startsWith(prefix))
    .reduce((sum, [, xp]) => sum + xp, 0);

  // Today in the current month; otherwise nothing until a day is tapped.
  const selected = picked?.startsWith(prefix) ? picked : offset === 0 ? dayKey(now) : null;
  const selectedWeek = selected ? weeks.find((w) => w.days.some((d) => d.key === selected)) : undefined;
  const selectedWorkouts = (data?.workouts ?? []).filter((w) => dayKey(new Date(w.started_at)) === selected);
  const weekRow = selectedWeek ? data?.weeks.find((w) => w.week_start === selectedWeek.weekStart) : undefined;

  const go = (delta: number) => {
    Haptics.selectionAsync();
    setOffset((o) => o + delta);
  };

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.monthRow}>
        <AppText style={styles.monthTitle}>
          {shown.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </AppText>
        <Arrow name="chevron.left" label="Previous month" disabled={offset >= MONTHS_BACK} onPress={() => go(1)} />
        <Arrow name="chevron.right" label="Next month" disabled={offset === 0} onPress={() => go(-1)} />
      </View>

      <View style={styles.tiles}>
        <Tile emoji="🔥" value={stats.daysWorked} label="Days worked out" badge={stats.perfect ? 'PERFECT' : undefined} />
        <Tile emoji="⚡" value={monthXp} label="XP earned" />
        <Tile emoji="❄️" value={stats.freezesUsed} label="Freezes used" />
      </View>

      <Card style={styles.calendar}>
        <View style={styles.week}>
          {WEEKDAYS.map((d) => (
            <AppText key={d} variant="caption" style={styles.weekday}>
              {d}
            </AppText>
          ))}
        </View>
        {isPending ? (
          <ActivityIndicator color={Colors.flame} style={{ marginVertical: Spacing.xl }} />
        ) : (
          weeks.map((w) => {
            const band = w.status ? BAND[w.status] : undefined;
            const [first, last] = monthSpan(w.days);
            return (
              <View key={w.weekStart} style={styles.week}>
                {band && (
                  <View style={[styles.band, span(first, last), { backgroundColor: band.fill }]} />
                )}
                {workoutRuns(w.days).map(([a, b]) => (
                  <View key={a} style={[styles.run, span(a, b)]} />
                ))}
                {w.days.map((d) => (
                  <Pressable
                    key={d.key}
                    disabled={!d.inMonth || d.future}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPicked(d.key);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.day}${d.worked ? ', worked out' : ''}`}
                    accessibilityState={{ selected: d.key === selected }}
                    style={styles.cell}>
                    {d.inMonth && (
                      <View
                        style={[
                          styles.dayDot,
                          d.today && styles.today,
                          d.key === selected && !d.today && styles.selected,
                        ]}>
                        <AppText
                          style={[
                            styles.dayText,
                            { color: d.worked ? '#fff' : d.future ? Colors.textMuted : Colors.text },
                          ]}>
                          {d.day}
                        </AppText>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            );
          })
        )}
        <View style={styles.legend}>
          <Legend color={Colors.flame} label="Workout" />
          {Object.values(BAND).map((b) => (
            <Legend key={b.label} color={b.fill} label={b.label} />
          ))}
        </View>
      </Card>

      {selected && (
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.dayHeader}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </AppText>
            <View style={styles.xpChip}>
              <AppText variant="caption" color={Colors.text} style={{ fontWeight: '700' }}>
                ⚡ {data?.xpByDay[selected] ?? 0} XP
              </AppText>
            </View>
          </View>
          {selectedWorkouts.length ? (
            selectedWorkouts.map((w) => (
              <Link key={w.id} href={{ pathname: '/workout/[id]', params: { id: w.id } }} asChild>
                <Pressable style={styles.workoutLine}>
                  <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {workoutLabel(w.activity_type)} · {formatDuration(w.duration_s)}
                    {w.counted ? '' : ' · didn’t count'}
                  </AppText>
                  <SymbolView name="chevron.right" size={12} tintColor={Colors.textMuted} />
                </Pressable>
              </Link>
            ))
          ) : (
            <AppText variant="caption">No workouts this day.</AppText>
          )}
          {selectedWeek && weekRow && (
            <Link href={{ pathname: '/week/[start]', params: { start: selectedWeek.weekStart } }} asChild>
              <Pressable style={styles.weekLine}>
                <AppText variant="caption" style={{ flex: 1 }}>
                  Week: {WEEK_LINE[weekRow.status]} · {weekRow.active_days}/{weekRow.goal} days
                </AppText>
                <AppText variant="caption" color={Colors.flame}>
                  See week
                </AppText>
              </Pressable>
            </Link>
          )}
        </Card>
      )}
    </View>
  );
}

/** Absolute position covering columns `first`–`last` of a week row. */
function span(first: number, last: number) {
  return { left: `${(first / 7) * 100}%`, width: `${((last - first + 1) / 7) * 100}%` } as const;
}

function Arrow({
  name,
  label,
  disabled,
  onPress,
}: {
  name: 'chevron.left' | 'chevron.right';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={styles.arrow}>
      <SymbolView name={name} size={18} weight="semibold" tintColor={disabled ? Colors.textMuted : Colors.text} />
    </Pressable>
  );
}

function Tile({ emoji, value, label, badge }: { emoji: string; value: number; label: string; badge?: string }) {
  return (
    <View style={[styles.tile, badge && styles.tilePerfect]}>
      {badge && (
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{badge}</AppText>
        </View>
      )}
      <View style={styles.tileValue}>
        <AppText style={{ fontSize: 18 }}>{emoji}</AppText>
        <AppText style={styles.tileNumber}>{value.toLocaleString()}</AppText>
      </View>
      <AppText variant="caption" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 12 }}>
        {label}
      </AppText>
    </View>
  );
}

function Legend({ color, label }: { color: ColorValue; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <AppText variant="caption" style={{ fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

const ROW = 44;

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  monthTitle: { flex: 1, fontFamily: Font.rounded, fontSize: 24, lineHeight: 30, fontWeight: '800', color: Colors.text },
  arrow: { padding: 4 },
  tiles: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  tile: {
    flex: 1,
    gap: 2,
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  tilePerfect: { borderColor: Colors.flame },
  badge: {
    position: 'absolute',
    top: -11,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.flame,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tileValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileNumber: { fontFamily: Font.rounded, fontSize: 22, lineHeight: 28, fontWeight: '800', color: Colors.text, fontVariant: ['tabular-nums'] },
  calendar: { gap: 4, paddingHorizontal: Spacing.sm },
  week: { flexDirection: 'row', height: ROW, alignItems: 'center' },
  weekday: { flex: 1, textAlign: 'center', fontWeight: '700' },
  band: { position: 'absolute', top: 2, bottom: 2, borderRadius: ROW / 2 },
  run: { position: 'absolute', top: 5, bottom: 5, borderRadius: ROW / 2, backgroundColor: Colors.flame },
  cell: { flex: 1, height: ROW, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: Colors.text },
  selected: { borderWidth: 2, borderColor: Colors.textMuted },
  dayText: { fontFamily: Font.rounded, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center', marginTop: Spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  xpChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: Colors.xpSoft },
  workoutLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  weekLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
