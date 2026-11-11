import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText, Card } from '@/components/ui';
import { Colors, DailyTargets, Radius, Spacing } from '@/constants/theme';
import { useMyGroups } from '@/hooks/use-groups';
import { useProgressWorkouts } from '@/hooks/use-home-data';
import { whenLabel } from '@/lib/cheers';
import type { DailyActivity } from '@/lib/database.types';
import { squadLine } from '@/lib/groups';
import { niceMax, weeklyAverage, weeklyTotals } from '@/lib/progress';
import { nextStepTier } from '@/lib/step-xp';
import { dayKey, startOfWeek } from '@/lib/week';
import { formatDuration, workoutIcon, workoutLabel } from '@/lib/workout-types';
import { workoutXp } from '@/lib/workout-xp';

type LatestWorkout = {
  id: string;
  activity_type: string;
  duration_s: number;
  started_at: string;
  counted: boolean;
  photo_paths: string[];
};

/** Today's activity on Home: a glance with no screen behind it, so its own card between the two. */
export function TodayCard({ today }: { today: DailyActivity | null }) {
  return (
    <Card style={styles.card}>
      <TodayRow today={today} />
    </Card>
  );
}

/**
 * Home's links out, one row each: groups, your latest workout and the 12-week
 * trend. Each row opens the screen with the full story.
 */
export function HomeSummary({ latest, verified }: { latest: LatestWorkout | undefined; verified: boolean }) {
  return (
    <Card style={styles.card}>
      {[
        <GroupsRow key="groups" />,
        <WorkoutRowSummary key="workout" latest={latest} verified={verified} />,
        <TrendRow key="trend" />,
      ].map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={styles.divider} />}
          {row}
        </Fragment>
      ))}
    </Card>
  );
}

function GroupsRow() {
  const { data: groups, isSuccess } = useMyGroups();
  if (!isSuccess) return <Row lead={<IconTile name="person.3.fill" />} title="Groups" subtitle=" " />;
  if (!groups.length) {
    return (
      <Row
        href="/group/new"
        lead={<IconTile name="person.3.fill" />}
        title="Start or join a group"
        subtitle="Race friends each week, keep a squad streak"
      />
    );
  }
  const best = [...groups].sort((a, b) => b.squad_streak - a.squad_streak)[0]!;
  const one = groups.length === 1;
  return (
    <Row
      href={one ? { pathname: '/group/[id]', params: { id: best.id } } : '/partners'}
      lead={
        <View style={styles.tile}>
          <AppText style={styles.emoji}>{best.emoji}</AppText>
        </View>
      }
      title={one ? best.name : `${groups.length} groups`}
      subtitle={one ? squadLine(best) : groups.map((g) => g.name).join(' · ')}
      trail={
        <View style={styles.squad}>
          <AppText style={[styles.chipText, { color: best.squad_streak > 0 ? Colors.flame : Colors.textMuted }]}>
            🔥 {best.squad_streak}
          </AppText>
        </View>
      }
    />
  );
}

function TodayRow({ today }: { today: DailyActivity | null }) {
  const kcal = Math.round(today?.active_kcal ?? 0);
  const min = Math.round(today?.exercise_min ?? 0);
  const steps = today?.steps ?? 0;
  const next = nextStepTier(steps);
  return (
    <Row
      lead={<MiniRings kcal={kcal} min={min} steps={steps} />}
      title="Today"
      subtitle={`${kcal} kcal · ${min} min · ${steps.toLocaleString()} steps`}
      trail={
        next ? (
          <View style={styles.xpChip} accessibilityLabel={`${next.xp} XP at ${next.steps.toLocaleString()} steps`}>
            <AppText style={styles.chipText}>
              +{next.xp} XP at {next.steps / 1000}k
            </AppText>
          </View>
        ) : undefined
      }
    />
  );
}

function WorkoutRowSummary({ latest, verified }: { latest: LatestWorkout | undefined; verified: boolean }) {
  if (!latest) {
    return (
      <Row
        href="/log"
        lead={<IconTile name="figure.run" tint />}
        title="Log your first workout"
        subtitle="Apple Health workouts show up on their own"
      />
    );
  }
  const xp = workoutXp({
    durationS: latest.duration_s,
    counted: latest.counted,
    hasPhoto: latest.photo_paths.length > 0,
    verified,
  });
  const weekStart = dayKey(startOfWeek(new Date(latest.started_at)));
  return (
    <Row
      href={{ pathname: '/week/[start]', params: { start: weekStart } }}
      lead={<IconTile name={workoutIcon(latest.activity_type)} tint />}
      title={workoutLabel(latest.activity_type)}
      subtitle={`${formatDuration(latest.duration_s)} · ${whenLabel(latest.started_at)}`}
      trail={
        latest.counted ? (
          <View style={styles.xpChip}>
            <AppText style={styles.chipText}>+{xp.earned} XP</AppText>
          </View>
        ) : undefined
      }
      hint="Opens this week’s workouts"
    />
  );
}

/** Matches the Progress chart's default range, so the average agrees with the screen it opens. */
const WEEKS = 12;

function TrendRow() {
  const { data: workouts } = useProgressWorkouts();
  const totals = useMemo(() => weeklyTotals(workouts ?? [], WEEKS), [workouts]);
  const average = weeklyAverage(totals, 'minutes');
  const max = niceMax(Math.max(average, ...totals.map((t) => t.minutes)));
  return (
    <Row
      href="/progress"
      lead={
        <View style={[styles.tile, styles.bars]}>
          {totals.slice(-5).map((t) => (
            <View
              key={t.weekStart}
              style={[
                styles.bar,
                {
                  height: t.minutes > 0 ? Math.max(3, (t.minutes / max) * 18) : 2,
                  backgroundColor: t.isCurrent ? Colors.flameSoft : Colors.flame,
                },
              ]}
            />
          ))}
        </View>
      }
      title={`Last ${WEEKS} weeks`}
      subtitle={average > 0 ? `${formatDuration(average * 60)} a week on average` : 'Active minutes per week'}
    />
  );
}

function Row({
  href,
  lead,
  title,
  subtitle,
  trail,
  hint,
}: {
  href?: Href;
  lead: ReactNode;
  title: string;
  subtitle: string;
  trail?: ReactNode;
  hint?: string;
}) {
  const content = (
    <>
      {lead}
      <View style={styles.text}>
        <AppText style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      {trail}
      {href && <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={Colors.textMuted} />}
    </>
  );
  if (!href) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${title}. ${subtitle}`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  );
}

function IconTile({ name, tint = false }: { name: Parameters<typeof SymbolView>[0]['name']; tint?: boolean }) {
  return (
    <View style={[styles.tile, tint && { backgroundColor: Colors.flameSoft }]}>
      <SymbolView name={name} size={17} tintColor={tint ? Colors.flame : Colors.textSecondary} />
    </View>
  );
}

const RINGS = 34;
const RING_STROKE = 4;

/** Move, exercise and steps as three small rings. */
function MiniRings({ kcal, min, steps }: { kcal: number; min: number; steps: number }) {
  const rings = [
    { color: Colors.ringMove, progress: kcal / DailyTargets.activeKcal },
    { color: Colors.ringExercise, progress: min / DailyTargets.exerciseMin },
    { color: Colors.ringSteps, progress: steps / DailyTargets.steps },
  ];
  return (
    <Svg width={RINGS} height={RINGS} style={{ transform: [{ rotate: '-90deg' }] }}>
      {rings.map((r, i) => {
        const radius = RINGS / 2 - RING_STROKE / 2 - i * (RING_STROKE + 1);
        const c = 2 * Math.PI * radius;
        return (
          <Fragment key={i}>
            <Circle cx={RINGS / 2} cy={RINGS / 2} r={radius} stroke={r.color} strokeOpacity={0.2} strokeWidth={RING_STROKE} fill="none" />
            <Circle
              cx={RINGS / 2}
              cy={RINGS / 2}
              r={radius}
              stroke={r.color}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - Math.min(Math.max(r.progress, 0), 1))}
              fill="none"
            />
          </Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: Spacing.xs, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 34 + Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md - 4, minHeight: 58, paddingVertical: Spacing.sm },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: Colors.text },
  tile: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  emoji: { fontSize: 18, lineHeight: 22 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingBottom: 7 },
  bar: { width: 3, borderRadius: 1 },
  squad: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Colors.flameSoft },
  xpChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Colors.xpSoft },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: Colors.text },
});
