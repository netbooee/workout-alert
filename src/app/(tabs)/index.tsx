import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRings } from '@/components/activity-rings';
import { StreakHero } from '@/components/streak-hero';
import { AppText, Card } from '@/components/ui';
import { WeekDots } from '@/components/week-dots';
import { WorkoutRow } from '@/components/workout-row';
import { Colors, Spacing } from '@/constants/theme';
import { useHealthSync } from '@/hooks/use-health-sync';
import { useHomeData } from '@/hooks/use-home-data';
import { useProfile } from '@/lib/auth';
import { buildWeek, weekState } from '@/lib/week';

export default function HomeScreen() {
  const profile = useProfile();
  const { sync, syncing, error: syncError } = useHealthSync();
  const { data, isPending, error } = useHomeData();

  const days = buildWeek(data?.weekWorkouts ?? [], profile.min_workout_minutes);
  const activeDays = days.filter((d) => d.active).length;
  const state = weekState(activeDays, profile.weekly_goal);
  const firstName = profile.display_name?.split(' ')[0];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={sync} tintColor={Colors.flame} />
        }>
        <AppText variant="title">{firstName ? `Hey, ${firstName}` : 'Hey there'}</AppText>

        {(error || syncError) && (
          <Card style={{ borderColor: Colors.danger }}>
            <AppText variant="caption" color={Colors.danger}>
              {(error ?? syncError)?.message}
            </AppText>
          </Card>
        )}

        {isPending ? (
          <ActivityIndicator color={Colors.flame} style={{ marginTop: Spacing.xl }} />
        ) : (
          <>
            <StreakHero streak={data?.streak ?? null} state={state} />
            <WeekDots days={days} goal={profile.weekly_goal} />
            <ActivityRings today={data?.today ?? null} />

            <Card>
              <AppText variant="label">Recent workouts</AppText>
              {data?.recentWorkouts.length ? (
                data.recentWorkouts.map((w) => <WorkoutRow key={w.id} workout={w} />)
              ) : (
                <View style={{ paddingVertical: Spacing.md, gap: Spacing.xs }}>
                  <AppText variant="body">No workouts yet.</AppText>
                  <AppText variant="caption">
                    Workouts from Apple Watch, Fitness, Strava, or any app that writes to Apple
                    Health will appear here automatically. Pull down to sync.
                  </AppText>
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
});
