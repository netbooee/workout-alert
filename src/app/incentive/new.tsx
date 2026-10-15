import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useOfferIncentive } from '@/hooks/use-incentives';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePartners } from '@/hooks/use-social';
import type { IncentiveGoalKind } from '@/lib/database.types';
import {
  GOAL_ACTIVITIES,
  GOAL_OPTIONS,
  goalOption,
  incentiveGoalText,
  NOTES_MAX,
  REWARD_PRESETS,
  WINDOW_OPTIONS,
} from '@/lib/incentives';

/** Offer a partner a real-world reward for a stretch goal. */
export default function NewIncentiveScreen() {
  const { to } = useLocalSearchParams<{ to: string }>();
  const { data: partners } = usePartners();
  const partner = partners?.find((p) => p.partner_id === to);
  const firstName = partner?.display_name?.split(' ')[0] ?? 'your partner';
  const offer = useOfferIncentive();
  const keyboardHeight = useKeyboardHeight();

  const [kind, setKind] = useState<IncentiveGoalKind>('workout_days');
  const [target, setTarget] = useState(goalOption('workout_days').defaultTarget);
  const [activity, setActivity] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<number>(1);
  const [emoji, setEmoji] = useState<string>(REWARD_PRESETS[0].emoji);
  const [reward, setReward] = useState<string>(REWARD_PRESETS[0].reward);
  const [notes, setNotes] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const option = goalOption(kind);
  const max = option.max(weeks);
  const clamp = (n: number) => Math.max(option.step, Math.min(n, max));

  const pickKind = (next: IncentiveGoalKind) => {
    Haptics.selectionAsync();
    setKind(next);
    const nextOption = goalOption(next);
    // Suggest a stretch: one more than they're doing for streaks, else the default.
    setTarget(
      next === 'streak_weeks'
        ? Math.max(nextOption.defaultTarget, (partner?.current_weeks ?? 0) + 2)
        : nextOption.defaultTarget * weeks,
    );
  };

  const pickWeeks = (next: number) => {
    Haptics.selectionAsync();
    setWeeks(next);
    if (kind !== 'streak_weeks') setTarget(Math.min(option.defaultTarget * next, option.max(next)));
  };

  const send = () => {
    if (!to || !reward.trim()) return;
    offer.mutate(
      {
        p_to: to,
        p_goal_kind: kind,
        p_goal_target: clamp(target),
        p_weeks: weeks,
        p_reward: reward.trim(),
        p_reward_emoji: emoji,
        p_activity_type: kind === 'workouts' ? activity : null,
        p_verified_only: verifiedOnly,
        p_notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (e) => Alert.alert('Could not send', e instanceof Error ? e.message : String(e)),
      },
    );
  };

  const summary = incentiveGoalText({ goal_kind: kind, goal_target: clamp(target), activity_type: activity, weeks });

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AppText variant="heading" color={Colors.textSecondary}>
            Cancel
          </AppText>
        </Pressable>
        <AppText variant="heading">Offer an incentive</AppText>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <View style={styles.partner}>
          {to && <Avatar id={to} name={partner?.display_name ?? null} size={44} />}
          <View style={{ flex: 1 }}>
            <AppText variant="heading">Reward {firstName} for extra effort 🎁</AppText>
            {partner && (
              <AppText variant="caption">
                {partner.this_week_days}/{partner.this_week_goal} days this week · {partner.current_weeks}-week streak
              </AppText>
            )}
          </View>
        </View>

        <AppText variant="label">Goal</AppText>
        <View style={styles.chips}>
          {GOAL_OPTIONS.map((g) => (
            <Chip key={g.kind} label={g.label} selected={g.kind === kind} onPress={() => pickKind(g.kind)} />
          ))}
        </View>

        <Card style={styles.stepper}>
          <StepButton label="−" onPress={() => setTarget(clamp(target - option.step))} />
          <View style={{ alignItems: 'center' }}>
            <AppText variant="display" style={{ fontSize: 44 }}>
              {clamp(target)}
            </AppText>
            <AppText variant="caption">{option.unit}</AppText>
          </View>
          <StepButton label="+" onPress={() => setTarget(clamp(target + option.step))} />
        </Card>

        {kind === 'workouts' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {GOAL_ACTIVITIES.map((a) => (
              <Chip key={a.label} label={a.label} selected={a.type === activity} onPress={() => setActivity(a.type)} />
            ))}
          </ScrollView>
        )}

        <AppText variant="label">Time to do it</AppText>
        <View style={styles.chips}>
          {WINDOW_OPTIONS.map((w) => (
            <Chip key={w.weeks} label={w.label} selected={w.weeks === weeks} onPress={() => pickWeeks(w.weeks)} />
          ))}
        </View>
        <AppText variant="caption" style={{ marginTop: -Spacing.sm }}>
          Counts from this Monday, so workouts they’ve already done this week count.
        </AppText>

        <AppText variant="label">Reward</AppText>
        <View style={styles.presets}>
          {REWARD_PRESETS.map((p) => (
            <Pressable
              key={p.emoji}
              onPress={() => {
                Haptics.selectionAsync();
                setEmoji(p.emoji);
                setReward(p.reward);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: emoji === p.emoji }}
              accessibilityLabel={p.label}
              style={[styles.preset, emoji === p.emoji && styles.presetSelected]}>
              <AppText variant="title" style={{ fontSize: 26 }}>
                {p.emoji}
              </AppText>
              <AppText
                variant="caption"
                color={emoji === p.emoji ? Colors.text : Colors.textSecondary}
                style={styles.presetLabel}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {p.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={reward}
          onChangeText={setReward}
          maxLength={80}
          placeholder="What will you treat them to?"
          placeholderTextColor={Colors.textMuted}
        />
        <AppText variant="caption" style={{ marginTop: -Spacing.sm }}>
          Real-world rewards only. You’ll mark it delivered once you’ve paid up.
        </AppText>

        <AppText variant="label">Rules and notes</AppText>
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          maxLength={NOTES_MAX}
          multiline
          placeholder="Optional: what counts, where you’ll celebrate, anything they should know"
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel="Rules and notes"
        />

        <Card style={styles.toggle}>
          <View style={{ flex: 1 }}>
            <AppText variant="body">Verified workouts only</AppText>
            <AppText variant="caption">Only Apple Health workouts or ones a partner verified count.</AppText>
          </View>
          <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{ true: Colors.flame }} />
        </Card>

        <Card style={styles.preview}>
          <AppText variant="caption">{firstName} will see</AppText>
          <AppText variant="heading">
            {summary} → {emoji} {reward.trim() || '…'}
          </AppText>
          {notes.trim() ? <AppText variant="body">{notes.trim()}</AppText> : null}
          <AppText variant="caption" color={Colors.xp}>
            +100 XP for {firstName} when they earn it
          </AppText>
        </Card>
      </ScrollView>

      <View style={[styles.footer, keyboardHeight > 0 && { paddingBottom: Spacing.md }]}>
        <Button
          title={`Send to ${firstName}`}
          loading={offer.isPending}
          disabled={!reward.trim() || !partner}
          onPress={send}
        />
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <AppText variant="caption" color={selected ? '#000' : Colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={styles.step}>
      <AppText variant="title">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  partner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Three labeled tiles per row.
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.sm },
  preset: {
    width: '31.5%',
    minHeight: 76,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 6,
    gap: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetSelected: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  presetLabel: { fontWeight: '600', textAlign: 'center' },
  notes: { height: undefined, minHeight: 96, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  input: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  preview: { backgroundColor: Colors.flameSoft, borderColor: Colors.flame },
  footer: { padding: Spacing.md, paddingBottom: Spacing.xl },
});
