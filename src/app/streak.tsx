import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ColorValue } from 'react-native';

import { FriendStreaks } from '@/components/friend-streaks';
import { StreakHistory } from '@/components/streak-history';
import { AppText, Card, Segmented } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useHomeData, useStreakHistory } from '@/hooks/use-home-data';
import { useProfile } from '@/lib/auth';
import type { StreakWeek } from '@/lib/database.types';
import { weekRangeLabel } from '@/lib/progress';
import {
  MAX_FREEZES,
  milestoneLabel,
  nextMilestone,
  WEEKS_PER_FREEZE,
  weeksToNextFreeze,
} from '@/lib/streak';

const STATUS: Record<StreakWeek['status'], { label: string; color: ColorValue }> = {
  hit: { label: 'Goal hit 🔥', color: Colors.flame },
  frozen: { label: 'Covered by a freeze ❄️', color: Colors.freeze },
  missed: { label: 'Goal missed', color: Colors.textSecondary },
  in_progress: { label: 'In progress', color: Colors.textSecondary },
  rest: { label: 'Rest week 😴', color: Colors.rest },
};

/**
 * The streak in detail. Personal: next milestone, how freezes work, and
 * week-by-week history. Friends: a friend streak with each partner.
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
  const { data: history } = useStreakHistory(12);

  if (isPending || !data) {
    return <ActivityIndicator color={Colors.flame} style={{ marginTop: Spacing.xl }} />;
  }

  const weeks = data.streak?.current_weeks ?? 0;
  const longest = data.streak?.longest_weeks ?? 0;
  const freezes = data.streak?.freezes_banked ?? 0;
  const milestone = nextMilestone(weeks);
  const toFreeze = weeksToNextFreeze(weeks);
  const plural = (n: number) => `${n} goal week${n === 1 ? '' : 's'}`;

  return (
    <>
      <Card style={styles.hero}>
        <View style={[styles.flame, { backgroundColor: weeks > 0 ? Colors.flameSoft : Colors.cardRaised }]}>
          <SymbolView name="flame.fill" size={48} tintColor={weeks > 0 ? Colors.flame : Colors.textMuted} />
        </View>
        <AppText variant="display">{weeks}</AppText>
        <AppText variant="caption">week streak · longest {longest}</AppText>
        {profile.resting_since && (
          <AppText variant="body" color={Colors.rest}>
            Rest mode is on. Your streak is protected 😴
          </AppText>
        )}
      </Card>

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

      {history && <StreakHistory weeks={history} />}

      {history && history.length > 0 && (
        <Card>
          <AppText variant="label">Week by week</AppText>
          {[...history].reverse().map((w) => {
            const status = STATUS[w.status];
            return (
              <Link key={w.week_start} href={{ pathname: '/week/[start]', params: { start: w.week_start } }} asChild>
                <Pressable style={styles.weekRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body">{weekRangeLabel(w.week_start)}</AppText>
                    <AppText variant="caption" color={status.color}>
                      {status.label}
                    </AppText>
                  </View>
                  <AppText variant="caption">
                    {w.active_days}/{w.goal} days
                  </AppText>
                  <SymbolView name="chevron.right" size={14} tintColor={Colors.textMuted} />
                </Pressable>
              </Link>
            );
          })}
        </Card>
      )}
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
  hero: { alignItems: 'center', gap: Spacing.xs },
  flame: {
    width: 88,
    height: 88,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  freezeChips: { flexDirection: 'row', gap: Spacing.xs },
  track: { height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised, overflow: 'hidden', marginVertical: Spacing.xs },
  fill: { height: '100%', borderRadius: 5 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
});
