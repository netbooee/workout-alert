import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMarkIncentiveDelivered, useRespondToIncentive } from '@/hooks/use-incentives';
import { useNames } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import type { Incentive } from '@/lib/database.types';
import { incentiveGoalText, progressFraction, timeLeft } from '@/lib/incentives';

const fail = (title: string) => (e: unknown) =>
  Alert.alert(title, e instanceof Error ? e.message : String(e));

/**
 * An incentive from either side: what you were offered (accept, track, earn)
 * or what you offered a partner (track, mark delivered). Tapping opens the
 * detail screen unless `linked` is false.
 */
export function IncentiveCard({ incentive: i, linked = true }: { incentive: Incentive; linked?: boolean }) {
  const me = useAuth().session?.user.id;
  const nameOf = useNames();
  const respond = useRespondToIncentive();
  const deliver = useMarkIncentiveDelivered();
  const received = i.to_id === me;
  const other = nameOf(received ? i.from_id : i.to_id).split(' ')[0];

  const title = received ? `${other}’s incentive for you` : `Your incentive for ${other}`;
  const card = (
    <Card style={[styles.card, i.status === 'earned' && styles.earned]}>
      <View style={styles.header}>
        <View style={styles.emoji}>
          <AppText variant="title" style={{ fontSize: 26 }}>
            {i.reward_emoji}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" style={{ fontSize: 12 }}>
            🎁 {title}
          </AppText>
          <AppText variant="heading">{i.reward}</AppText>
          <AppText variant="caption">
            {incentiveGoalText(i)}
            {i.verified_only ? ' · verified only' : ''}
          </AppText>
        </View>
      </View>

      {(i.status === 'active' || i.status === 'offered') && (
        <View style={{ gap: 6 }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progressFraction(i) * 100}%` }]} />
          </View>
          <View style={styles.row}>
            <AppText variant="caption">
              {i.status === 'active'
                ? `${i.progress} of ${i.goal_target}`
                : received
                  ? 'Accept to start tracking'
                  : `Waiting for ${other} to accept`}
            </AppText>
            <AppText variant="caption">{timeLeft(i.ends_at)}</AppText>
          </View>
        </View>
      )}

      {i.status === 'offered' && received && (
        <View style={styles.row}>
          <Button
            title="Not now"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={respond.isPending}
            onPress={() => respond.mutate({ id: i.id, accept: false }, { onError: fail('Could not decline') })}
          />
          <Button
            title="Accept 🎁"
            style={{ flex: 1 }}
            loading={respond.isPending}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              respond.mutate({ id: i.id, accept: true }, { onError: fail('Could not accept') });
            }}
          />
        </View>
      )}

      {i.status === 'earned' && (
        <View style={{ gap: Spacing.sm }}>
          <AppText variant="body" color={Colors.success}>
            {received ? `🎉 You earned it! +100 XP. ${other} owes you this one.` : `🎉 ${other} earned it!`}
          </AppText>
          {!received && (
            <Button
              title="Mark as delivered"
              loading={deliver.isPending}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                deliver.mutate(i.id, { onError: fail('Could not update') });
              }}
            />
          )}
        </View>
      )}

      {i.status === 'delivered' && (
        <AppText variant="caption" color={Colors.success}>
          ✓ Delivered{i.delivered_at ? ` ${new Date(i.delivered_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
        </AppText>
      )}
      {i.status === 'expired' && (
        <AppText variant="caption">
          Ended at {i.progress} of {i.goal_target}
          {received ? '. Every workout still counted 💪' : `. Offer ${other} another?`}
        </AppText>
      )}
      {i.status === 'declined' && <AppText variant="caption">{received ? 'You passed on this one' : `${other} passed on this one`}</AppText>}
      {i.status === 'cancelled' && <AppText variant="caption">Cancelled</AppText>}
    </Card>
  );

  if (!linked) return card;
  return (
    <Pressable onPress={() => router.push({ pathname: '/incentive/[id]', params: { id: i.id } })}>{card}</Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  earned: { borderColor: Colors.success, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emoji: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.flameSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: Colors.cardRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: Colors.flame },
});
