import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRings } from '@/components/activity-rings';
import { CheerCard } from '@/components/cheer-card';
import { IncentiveCard } from '@/components/incentive-card';
import { Mascot } from '@/components/mascots';
import { NudgeBanner } from '@/components/nudge-banner';
import { ProgressMini } from '@/components/progress-mini';
import { StreakHero } from '@/components/streak-hero';
import { ActionPill, AppText, Button, Card } from '@/components/ui';
import { WeekDots } from '@/components/week-dots';
import { WorkoutRow } from '@/components/workout-row';
import { Colors, Spacing } from '@/constants/theme';
import { useHealthSync } from '@/hooks/use-health-sync';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useLotl } from '@/hooks/use-lotl';
import { useHomeData } from '@/hooks/use-home-data';
import { useLeagueSettings, usePublicLeague } from '@/hooks/use-league';
import { useXpTotal } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { tierInfo } from '@/lib/leagues';
import { MASCOTS, mascotKind } from '@/lib/mascots';
import { buildWeek, weekState } from '@/lib/week';

export default function HomeScreen() {
  const profile = useProfile();
  const { sync, syncing, error: syncError } = useHealthSync();
  const { data, isPending, error } = useHomeData();
  const { data: xp } = useXpTotal();
  const lotl = useLotl();
  const { received, given } = useMyIncentives();
  const [openedAt] = useState(() => Date.now());
  // Offers and live goals stay on Home; earned ones for a few days, then on the reward shelf.
  // Shared quests you started count your workouts too, so they live on your Home as well.
  const incentives = [...received, ...given.filter((i) => i.shared)].filter(
    (i) =>
      i.status === 'offered' ||
      i.status === 'active' ||
      (i.status === 'earned' && openedAt - new Date(i.earned_at ?? 0).getTime() < EARNED_ON_HOME_MS),
  );

  const days = buildWeek(data?.weekWorkouts ?? [], profile.min_workout_minutes);
  const activeDays = days.filter((d) => d.active).length;
  const state = weekState(activeDays, profile.weekly_goal);
  const firstName = profile.display_name?.split(' ')[0];
  const leagueSettings = useLeagueSettings();
  const inLeague = !!leagueSettings.data?.opted_in;
  const { data: leagueRows } = usePublicLeague(inLeague);
  const myLeagueRow = leagueRows?.find((r) => r.is_me);
  const leagueTier = tierInfo(myLeagueRow?.tier ?? leagueSettings.data?.tier ?? 1);
  const league = leagueSettings.isSuccess
    ? {
        joined: inLeague,
        emoji: leagueTier.emoji,
        name: leagueTier.name,
        rank: myLeagueRow?.rank,
        size: myLeagueRow?.group_size,
      }
    : undefined;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={sync} tintColor={Colors.flame} />
        }>
        <View style={styles.titleRow}>
          <Link href="/greeting" asChild>
            <Pressable accessibilityLabel={`Talk to ${MASCOTS[mascotKind(profile.mascot)].name}`} hitSlop={8}>
              <Mascot kind={mascotKind(profile.mascot)} mood={lotl?.mood ?? 'ready'} size={52} />
              {/* Hints that your buddy has something to say. */}
              <View style={styles.talkBadge}>
                <SymbolView name="ellipsis.bubble.fill" size={13} tintColor="#fff" />
              </View>
            </Pressable>
          </Link>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{firstName ? `Hey, ${firstName}` : 'Hey there'}</AppText>
            {lotl && (
              <AppText variant="caption" numberOfLines={2}>
                {lotl.headline}
              </AppText>
            )}
          </View>
          <Link href="/log" asChild>
            <ActionPill icon="plus" label="Log" accessibilityLabel="Log a workout" />
          </Link>
        </View>

        {(error || syncError) && (
          <Card style={{ borderColor: Colors.danger }}>
            <AppText variant="caption" color={Colors.danger}>
              {(error ?? syncError)?.message}
            </AppText>
          </Card>
        )}

        {/* Your streak and this week come first; everything else supports them. */}
        {isPending ? (
          <ActivityIndicator color={Colors.flame} style={{ marginVertical: Spacing.xl }} />
        ) : (
          <Link href="/streak" asChild>
            <Pressable accessibilityRole="button" accessibilityHint="Opens your streak and freezes">
              <StreakHero
                streak={data?.streak ?? null}
                state={state}
                resting={!!profile.resting_since}
                league={league}
                xp={xp}
                showChevron>
                <WeekDots days={days} goal={profile.weekly_goal} embedded />
              </StreakHero>
            </Pressable>
          </Link>
        )}

        <NudgeBanner />
        <CheerCard />
        {incentives.length > 0 && <AppText variant="label">Challenges</AppText>}
        {incentives.map((i) => (
          <IncentiveCard key={i.id} incentive={i} collapsible />
        ))}

        {!isPending && (
          <>
            <Card>
              <AppText variant="label">Recent workouts</AppText>
              {data?.recentWorkouts.length ? (
                <>
                  {data.recentWorkouts.slice(0, RECENT_COUNT).map((w) => (
                    <Link key={w.id} href={{ pathname: '/workout/[id]', params: { id: w.id } }} asChild>
                      <Pressable>
                        <WorkoutRow workout={w} showXp verified={!!data.verifiedIds?.includes(w.id)} />
                      </Pressable>
                    </Link>
                  ))}
                  {data.recentWorkouts.length > RECENT_COUNT && (
                    <Link href={{ pathname: '/me', params: { section: 'progress' } }} asChild>
                      <Pressable hitSlop={8} style={styles.more}>
                        <AppText variant="caption" color={Colors.flame}>
                          See older workouts by week
                        </AppText>
                      </Pressable>
                    </Link>
                  )}
                </>
              ) : (
                <View style={{ paddingVertical: Spacing.md, gap: Spacing.xs }}>
                  <AppText variant="body">No workouts yet.</AppText>
                  <AppText variant="caption">
                    Workouts from Apple Watch, Fitness, Strava, or any app that writes to Apple
                    Health will appear here automatically. Pull down to sync, or add one by hand.
                  </AppText>
                  <Link href="/log" asChild>
                    <Button title="+ Log a workout" style={{ marginTop: Spacing.xs }} />
                  </Link>
                </View>
              )}
            </Card>

            <AppText variant="label" style={{ marginTop: Spacing.sm }}>
              Today’s activity
            </AppText>
            <ActivityRings today={data?.today ?? null} />
            <ProgressMini />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const EARNED_ON_HOME_MS = 3 * 24 * 3600 * 1000;

/** Older workouts are a tap away in the Progress chart's week view. */
const RECENT_COUNT = 5;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  talkBadge: {
    position: 'absolute',
    right: -4,
    top: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.flame,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  more: { alignItems: 'center', paddingTop: Spacing.xs },
});
