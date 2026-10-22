import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FeedCard } from '@/components/feed-card';
import { IncentiveCard } from '@/components/incentive-card';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useNudge, usePartners, usePartnerWorkouts } from '@/hooks/use-social';
import { isOpen } from '@/lib/incentives';

/** One partner: their week and streaks, what's going on between you, and their recent workouts to cheer. */
export default function PartnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: partners } = usePartners();
  const partner = partners?.find((p) => p.partner_id === id);
  const { data: workouts, isPending } = usePartnerWorkouts(id);
  const { given, received } = useMyIncentives();
  const nudge = useNudge();
  const firstName = partner?.display_name?.split(' ')[0] ?? 'Partner';
  const challenges = [...given, ...received].filter(
    (i) => (i.from_id === id || i.to_id === id) && (isOpen(i) || i.status === 'earned'),
  );
  const done = partner ? partner.this_week_days >= partner.this_week_goal : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: firstName }} />
      {partner && (
        <Card style={styles.header}>
          <Avatar id={partner.partner_id} name={partner.display_name} size={56} />
          <AppText variant="title">{partner.display_name ?? 'Partner'}</AppText>
          <View style={styles.stats}>
            <Stat value={`🔥 ${partner.current_weeks}`} label="week streak" />
            <Stat value={`${partner.this_week_days}/${partner.this_week_goal}`} label="days this week" />
            <Stat value={`🤝 ${partner.friend_streak}`} label="weeks together" />
          </View>
          <View style={styles.actions}>
            {!done && (
              <Button
                title={partner.recently_nudged ? 'Nudged 👋' : `👋 Nudge`}
                variant="secondary"
                style={{ flex: 1 }}
                disabled={partner.recently_nudged}
                loading={nudge.isPending}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  nudge.mutate(partner.partner_id, {
                    onError: (e) => Alert.alert('Could not nudge', e instanceof Error ? e.message : String(e)),
                  });
                }}
              />
            )}
            {!given.some((i) => i.to_id === id && isOpen(i)) && (
              <Button
                title="🎯 Challenge"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/incentive/new', params: { to: partner.partner_id } })}
              />
            )}
          </View>
        </Card>
      )}

      {challenges.length > 0 && (
        <AppText variant="label" style={{ marginTop: Spacing.sm }}>
          Challenges with {firstName}
        </AppText>
      )}
      {challenges.map((i) => (
        <IncentiveCard key={i.id} incentive={i} collapsible />
      ))}

      <AppText variant="label" style={{ marginTop: Spacing.sm }}>
        {firstName}’s workouts
      </AppText>
      {isPending ? (
        <ActivityIndicator color={Colors.flame} />
      ) : workouts?.length ? (
        workouts.map((item) => <FeedCard key={item.workout.id} item={item} name={firstName} />)
      ) : (
        <AppText variant="caption">No workouts yet.</AppText>
      )}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" style={{ fontSize: 11 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  header: { alignItems: 'center', gap: Spacing.sm },
  stats: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around', marginTop: Spacing.xs },
  stat: { alignItems: 'center', gap: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch', marginTop: Spacing.xs },
});
