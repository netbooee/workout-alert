import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { QuestProgress } from '@/components/quest-progress';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMarkIncentiveDelivered, useRespondToIncentive } from '@/hooks/use-incentives';
import { useNames, useNudge, usePartners } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import type { Incentive } from '@/lib/database.types';
import { goalOption, incentiveGoalText, progressFraction, timeLeft } from '@/lib/incentives';

const fail = (title: string) => (e: unknown) =>
  Alert.alert(title, e instanceof Error ? e.message : String(e));

/**
 * An incentive from either side: what you were offered (accept, track, earn)
 * or what you offered a partner (track, nudge, mark delivered). An active one
 * reads like Duolingo's Friends Quest: progress and what's left, with the next
 * action on the card. Tapping opens the detail screen unless `linked` is false.
 * With `collapsible` (Home), an active one starts as a single compact row that
 * expands to the full card; ones waiting on you stay open.
 */
export function IncentiveCard({
  incentive: i,
  linked = true,
  collapsible = false,
}: {
  incentive: Incentive;
  linked?: boolean;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const me = useAuth().session?.user.id;
  const nameOf = useNames();
  const respond = useRespondToIncentive();
  const deliver = useMarkIncentiveDelivered();
  const nudge = useNudge();
  const { data: partners } = usePartners();
  const received = i.to_id === me;
  const other = nameOf(received ? i.from_id : i.to_id).split(' ')[0];
  const recentlyNudged = !!partners?.find((p) => p.partner_id === (received ? i.from_id : i.to_id))
    ?.recently_nudged;
  const reached = i.progress >= i.goal_target;

  const title = i.shared
    ? `Together with ${other}`
    : received
      ? `${other}’s challenge for you`
      : `Your challenge for ${other}`;
  const otherId = received ? i.from_id : i.to_id;
  const theirShare = i.shared ? (received ? i.from_progress : i.progress - i.from_progress) : 0;
  const split = i.shared
    ? { mine: i.progress - theirShare, theirs: theirShare, otherName: other }
    : undefined;
  const canCollapse = collapsible && i.status === 'active';
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  if (canCollapse && !expanded) {
    return (
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityHint="Shows the whole challenge">
        <Card style={styles.compact}>
          <View style={styles.compactEmoji}>
            <AppText style={{ fontSize: 20 }}>{i.reward_emoji}</AppText>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading" numberOfLines={1} style={{ fontSize: 15 }}>
              {i.reward}
            </AppText>
            <View style={styles.compactTrack}>
              <View style={[styles.compactFill, { width: `${progressFraction(i) * 100}%` }]} />
            </View>
            <AppText variant="caption" numberOfLines={1} style={{ fontSize: 12 }}>
              {i.shared ? '🤝' : '🎯'} {Math.min(i.progress, i.goal_target)}/{i.goal_target}{' '}
              {goalOption(i.goal_kind).unit} · {timeLeft(i.ends_at)} · {title}
            </AppText>
          </View>
          <SymbolView name="chevron.down" size={14} weight="semibold" tintColor={Colors.textMuted} />
        </Card>
      </Pressable>
    );
  }

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
            {i.shared ? '🤝' : '🎯'} {title}
          </AppText>
          <AppText variant="heading">{i.reward}</AppText>
          <AppText variant="caption">
            {incentiveGoalText(i)}
            {i.verified_only ? ' · verified only' : ''}
          </AppText>
        </View>
        {canCollapse && (
          <Pressable
            onPress={toggle}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Show less"
            accessibilityState={{ expanded: true }}
            style={styles.collapse}>
            <SymbolView name="chevron.up" size={14} weight="semibold" tintColor={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {i.notes ? (
        <View style={styles.notes}>
          <AppText variant="label" style={{ fontSize: 11 }}>
            Rules and notes
          </AppText>
          {/* Two lines on Home; the whole thing on the incentive screen. */}
          <AppText variant="body" numberOfLines={linked ? 2 : undefined}>
            {i.notes}
          </AppText>
        </View>
      ) : null}

      {i.status === 'offered' && (
        <View style={styles.row}>
          <AppText variant="caption">
            {received ? 'Accept to start tracking' : `Waiting for ${other} to accept`}
          </AppText>
          <AppText variant="caption">{timeLeft(i.ends_at)}</AppText>
        </View>
      )}

      {i.status === 'active' && (
        <>
          <QuestProgress incentive={i} who={received || i.shared ? undefined : other} split={split} />
          {!reached && (
            <View style={styles.row}>
              {(received || i.shared) && (
                <Button title="Log a workout" style={{ flex: 1 }} onPress={() => router.push('/log')} />
              )}
              {(!received || i.shared) && (
                <Button
                  title={recentlyNudged ? 'Nudged 👋' : `👋 Nudge ${other}`}
                  variant="secondary"
                  style={{ flex: 1 }}
                  disabled={recentlyNudged}
                  loading={nudge.isPending}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    nudge.mutate(otherId, { onError: fail('Could not nudge') });
                  }}
                />
              )}
            </View>
          )}
        </>
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
            {i.shared
              ? `🎉 You and ${other} did it! +100 XP each. Enjoy it together.`
              : received
                ? `🎉 You earned it! +100 XP. ${other} owes you this one.`
                : `🎉 ${other} earned it!`}
          </AppText>
          {(!received || i.shared) && (
            <Button
              title={i.shared ? 'Mark as done' : 'Mark as delivered'}
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
          ✓ {i.shared ? 'Done' : 'Delivered'}{i.delivered_at ? ` ${new Date(i.delivered_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
        </AppText>
      )}
      {i.status === 'expired' && (
        <AppText variant="caption">
          Ended at {i.progress} of {i.goal_target}
          {received || i.shared ? '. Every workout still counted 💪' : `. Offer ${other} another?`}
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
  notes: { gap: 2, padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.cardRaised },
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
  collapse: { alignSelf: 'flex-start', padding: 4 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 },
  compactEmoji: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.flameSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.cardRaised, overflow: 'hidden' },
  compactFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.flame },
});
