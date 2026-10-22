import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type ColorValue } from 'react-native';

import { FriendStreaks } from '@/components/friend-streaks';
import { StreakCalendar } from '@/components/streak-calendar';
import { ActionPill, AppText, Card, Segmented } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useHomeData } from '@/hooks/use-home-data';
import { useXpTotal } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { levelFor } from '@/lib/levels';
import {
  MAX_FREEZES,
  milestoneLabel,
  nextMilestone,
  WEEKS_PER_FREEZE,
  weeksToNextFreeze,
} from '@/lib/streak';
import { dayKey } from '@/lib/week';

/**
 * The streak in detail, Duolingo-style. Personal: the streak and what keeps it
 * going this week, a month calendar with XP, the next milestone and freezes.
 * Friends: a friend streak with each partner.
 */
export default function StreakScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [view, setView] = useState<'personal' | 'friends'>(tab === 'friends' ? 'friends' : 'personal');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Streak' }} />
      <Segmented
        options={[
          { key: 'personal', label: 'Personal' },
          { key: 'friends', label: 'Friends' },
        ]}
        value={view}
        onChange={setView}
        size="large"
      />
      {view === 'personal' ? <PersonalStreak /> : <FriendStreaks />}
    </ScrollView>
  );
}

function PersonalStreak() {
  const profile = useProfile();
  const { data, isPending } = useHomeData();
  const { data: totalXp } = useXpTotal();

  if (isPending || !data) {
    return <ActivityIndicator color={Colors.flame} style={{ marginTop: Spacing.xl }} />;
  }

  const weeks = data.streak?.current_weeks ?? 0;
  const longest = data.streak?.longest_weeks ?? 0;
  const freezes = data.streak?.freezes_banked ?? 0;
  const milestone = nextMilestone(weeks);
  const toFreeze = weeksToNextFreeze(weeks);
  const plural = (n: number) => `${n} goal week${n === 1 ? '' : 's'}`;
  const goal = profile.weekly_goal;
  const daysThisWeek = new Set(
    data.weekWorkouts.filter((w) => w.counted).map((w) => dayKey(new Date(w.started_at))),
  ).size;
  const left = Math.max(goal - daysThisWeek, 0);
  const lit = weeks > 0;

  return (
    <>
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.heroNumber, !lit && { color: Colors.textMuted }]}>{weeks}</AppText>
          <AppText style={[styles.heroLabel, !lit && { color: Colors.textMuted }]}>
            week streak{lit ? '!' : ''}
          </AppText>
        </View>
        <View style={[styles.flame, { backgroundColor: lit ? Colors.flameSoft : Colors.cardRaised }]}>
          <SymbolView name="flame.fill" size={76} tintColor={lit ? Colors.flame : Colors.textMuted} />
        </View>
      </View>
      <View style={styles.chips}>
        <View style={styles.chip}>
          <AppText variant="caption" color={Colors.text}>
            🏆 Longest {longest} week{longest === 1 ? '' : 's'}
          </AppText>
        </View>
        {totalXp != null && (
          <View style={[styles.chip, { backgroundColor: Colors.xpSoft }]}>
            <AppText variant="caption" color={Colors.text}>
              ⚡ {totalXp.toLocaleString()} XP · Level {levelFor(totalXp).level}
            </AppText>
          </View>
        )}
        {weeks > 0 && (
          <ActionPill
            icon="square.and.arrow.up"
            label="Share"
            quiet
            accessibilityLabel="Share your streak"
            onPress={() => router.push({ pathname: '/share', params: { kind: 'streak', weeks: String(weeks) } })}
          />
        )}
      </View>

      <Card style={styles.tip}>
        <SymbolView
          name={profile.resting_since ? 'moon.zzz.fill' : 'flame.fill'}
          size={34}
          tintColor={profile.resting_since ? Colors.rest : Colors.flame}
        />
        <AppText variant="body" style={{ flex: 1 }}>
          {profile.resting_since ? (
            <>
              <AppText style={[styles.strong, { color: Colors.rest }]}>Rest mode</AppText> is on. Your
              streak is protected 😴
            </>
          ) : left > 0 ? (
            <>
              Work out <AppText style={styles.strong}>{left} more day{left === 1 ? '' : 's'}</AppText> this
              week to {lit ? 'keep your ' : 'start a '}
              <AppText style={styles.strong}>{lit ? `${weeks}-week streak` : 'streak'}</AppText>.
            </>
          ) : (
            <>
              <AppText style={styles.strong}>Goal hit!</AppText> Your streak is safe this week. Extra
              workouts still earn XP ⚡
            </>
          )}
        </AppText>
      </Card>

      <StreakCalendar />

      {milestone && (
        <Card>
          <AppText variant="label">Next milestone</AppText>
          <AppText variant="heading">🏆 {milestoneLabel(milestone)}</AppText>
          <Bar value={weeks} max={milestone} color={Colors.flame} />
          <AppText variant="caption">
            {plural(milestone - weeks)} to go · hit your goal of {profile.weekly_goal} day
            {profile.weekly_goal === 1 ? '' : 's'} each week
          </AppText>
        </Card>
      )}

      <Card>
        <View style={styles.freezeHeader}>
          <AppText variant="label">Streak freezes</AppText>
          <View style={styles.freezeChips}>
            {Array.from({ length: MAX_FREEZES }, (_, i) => (
              <SymbolView
                key={i}
                name="snowflake"
                size={22}
                tintColor={i < freezes ? Colors.freeze : Colors.textMuted}
              />
            ))}
          </View>
        </View>
        <AppText variant="heading">
          {freezes} of {MAX_FREEZES} banked
        </AppText>
        {freezes < MAX_FREEZES ? (
          <>
            <Bar value={WEEKS_PER_FREEZE - toFreeze} max={WEEKS_PER_FREEZE} color={Colors.freeze} />
            <AppText variant="caption">{plural(toFreeze)} in a row banks your next freeze.</AppText>
          </>
        ) : (
          <AppText variant="caption">Your freeze bank is full.</AppText>
        )}
        <AppText variant="caption">
          Miss a week and a freeze covers it automatically, so your streak survives. Every{' '}
          {WEEKS_PER_FREEZE} goal weeks in a row earns one, up to {MAX_FREEZES}.
        </AppText>
      </Card>
    </>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: ColorValue }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(value / max, 1) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  hero: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  heroNumber: {
    fontFamily: Font.rounded,
    fontSize: 84,
    lineHeight: 92,
    fontWeight: '900',
    color: Colors.flame,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: { fontFamily: Font.rounded, fontSize: 24, lineHeight: 30, fontWeight: '800', color: Colors.flame, marginTop: -6 },
  flame: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: Colors.cardRaised },
  tip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md + 2 },
  strong: { fontWeight: '800', color: Colors.flame },
  freezeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  freezeChips: { flexDirection: 'row', gap: Spacing.xs },
  track: { height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised, overflow: 'hidden', marginVertical: Spacing.xs },
  fill: { height: '100%', borderRadius: 5 },
});
