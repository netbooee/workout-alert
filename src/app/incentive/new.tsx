import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { RewardPicker } from '@/components/reward-picker';
import { AppText, Button, Card, Segmented } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useOfferIncentive } from '@/hooks/use-incentives';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePartners } from '@/hooks/use-social';
import type { IncentiveGoalKind } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import {
  GOAL_ACTIVITIES,
  GOAL_OPTIONS,
  goalOption,
  incentiveGoalText,
  NOTES_MAX,
  REWARD_PRESETS,
  rewardById,
  WINDOW_OPTIONS,
  type RewardPreset,
} from '@/lib/incentives';

/**
 * Offer a partner a real-world reward for a stretch goal, or start a shared
 * quest where both of your workouts count and you both earn the reward.
 */
export default function NewIncentiveScreen() {
  const { to, shared: sharedParam } = useLocalSearchParams<{ to: string; shared?: string }>();
  const [mode, setMode] = useState<'reward' | 'shared'>(sharedParam === '1' ? 'shared' : 'reward');
  const shared = mode === 'shared';
  const people = shared ? 2 : 1;
  const { data: partners } = usePartners();
  const partner = partners?.find((p) => p.partner_id === to);
  const firstName = partner?.display_name?.split(' ')[0] ?? 'your partner';
  const offer = useOfferIncentive();
  const keyboardHeight = useKeyboardHeight();

  const [kind, setKind] = useState<IncentiveGoalKind>('workout_days');
  const [target, setTarget] = useState(goalOption('workout_days').defaultTarget);
  const [activity, setActivity] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<number>(1);
  const [rewardId, setRewardId] = useState('custom');
  const [reward, setReward] = useState(REWARD_PRESETS[0]!.reward);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const picked = rewardById(rewardId) ?? REWARD_PRESETS[0]!;
  const emoji = picked.emoji;
  // A pick from the library shows on the "More…" tile.
  const fromLibrary = !REWARD_PRESETS.some((p) => p.id === rewardId);
  const [notes, setNotes] = useState('');
  const rewardInput = useRef<TextInput>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const option = goalOption(kind);
  const max = option.max(weeks, people);
  const clamp = (n: number) => Math.max(option.step, Math.min(n, max));

  const pickKind = (next: IncentiveGoalKind) => {
    Haptics.selectionAsync();
    setKind(next);
    const nextOption = goalOption(next);
    // Suggest a stretch: one more than they're doing for streaks, else the default.
    setTarget(
      next === 'streak_weeks'
        ? Math.max(nextOption.defaultTarget, (partner?.current_weeks ?? 0) + 2)
        : nextOption.defaultTarget * weeks * people,
    );
  };

  const pickMode = (next: 'reward' | 'shared') => {
    setMode(next);
    const nextPeople = next === 'shared' ? 2 : 1;
    // Streaks don't add up between two people; fall back to workout days.
    const nextKind = next === 'shared' && !option.shareable ? 'workout_days' : kind;
    setKind(nextKind);
    setTarget(goalOption(nextKind).defaultTarget * weeks * nextPeople);
  };

  const pickWeeks = (next: number) => {
    Haptics.selectionAsync();
    setWeeks(next);
    if (kind !== 'streak_weeks') setTarget(Math.min(option.defaultTarget * next * people, option.max(next, people)));
  };

  const pickReward = (p: RewardPreset, focusDelay = 0) => {
    setRewardId(p.id);
    setReward(p.reward);
    // Custom, cash and gift cards need words or an amount: jump into the text
    // (after the library sheet has closed, when picked from there).
    if (p.edit) setTimeout(() => rewardInput.current?.focus(), focusDelay);
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
        p_shared: shared,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (e) => Alert.alert('Could not send', friendlyError(e)),
      },
    );
  };

  const summary = incentiveGoalText({ goal_kind: kind, goal_target: clamp(target), activity_type: activity, weeks, shared });

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AppText variant="heading" color={Colors.textSecondary}>
            Cancel
          </AppText>
        </Pressable>
        <AppText variant="heading">Challenge {firstName}</AppText>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <View style={styles.partner}>
          {to && <Avatar id={to} name={partner?.display_name ?? null} size={44} />}
          <View style={{ flex: 1 }}>
            <AppText variant="heading">
              {shared ? `Team up with ${firstName} 🤝` : `Reward ${firstName} for extra effort 🎯`}
            </AppText>
            {partner && (
              <AppText variant="caption">
                {partner.this_week_days}/{partner.this_week_goal} days this week · {partner.current_weeks}-week streak
              </AppText>
            )}
          </View>
        </View>

        <Segmented
          options={[
            { key: 'reward', label: `Reward ${firstName}` },
            { key: 'shared', label: 'Do it together' },
          ]}
          value={mode}
          onChange={pickMode}
        />
        <AppText variant="caption" style={{ marginTop: -Spacing.sm }}>
          {shared
            ? `Both of your workouts count toward one goal, and you both earn the reward and +100 XP.`
            : `${firstName} works toward the goal and you treat them when they hit it.`}
        </AppText>

        <AppText variant="label">{shared ? 'Goal between you' : 'Goal'}</AppText>
        <View style={styles.chips}>
          {GOAL_OPTIONS.filter((g) => !shared || g.shareable).map((g) => (
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
          {shared
            ? 'Counts from this Sunday, so workouts you’ve both done this week count.'
            : 'Counts from this Sunday, so workouts they’ve already done this week count.'}
        </AppText>

        <AppText variant="label">Reward</AppText>
        <View style={styles.presets}>
          {REWARD_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                Haptics.selectionAsync();
                pickReward(p);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: rewardId === p.id }}
              accessibilityLabel={p.label}
              style={[styles.preset, rewardId === p.id && styles.presetSelected]}>
              <AppText variant="title" style={{ fontSize: 26 }}>
                {p.emoji}
              </AppText>
              <AppText
                variant="caption"
                color={rewardId === p.id ? Colors.text : Colors.textSecondary}
                style={styles.presetLabel}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {p.label}
              </AppText>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setLibraryOpen(true);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: fromLibrary }}
            accessibilityLabel={fromLibrary ? `${picked.label}. More rewards` : 'More rewards'}
            style={[styles.preset, fromLibrary && styles.presetSelected]}>
            {fromLibrary ? (
              <>
                {/* Still the way into the library: keep saying so once it shows a pick. */}
                <View style={styles.moreBadge}>
                  <SymbolView name="square.grid.2x2.fill" size={11} tintColor={Colors.textSecondary} />
                </View>
                <AppText variant="title" style={{ fontSize: 22 }}>
                  {picked.emoji}
                </AppText>
                <AppText
                  variant="caption"
                  color={Colors.text}
                  style={styles.presetLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}>
                  {picked.label}
                </AppText>
                <AppText variant="caption" color={Colors.flame} style={styles.moreHint}>
                  More…
                </AppText>
              </>
            ) : (
              <>
                <SymbolView name="square.grid.2x2.fill" size={26} tintColor={Colors.textSecondary} />
                <AppText variant="caption" color={Colors.textSecondary} style={styles.presetLabel}>
                  More…
                </AppText>
              </>
            )}
          </Pressable>
        </View>
        <RewardPicker
          visible={libraryOpen}
          selectedId={rewardId}
          onPick={(p) => {
            setLibraryOpen(false);
            pickReward(p, 400);
          }}
          onClose={() => setLibraryOpen(false)}
        />
        <TextInput
          ref={rewardInput}
          style={styles.input}
          value={reward}
          onChangeText={setReward}
          maxLength={80}
          selectTextOnFocus={!!picked.edit}
          placeholder={shared ? 'What will you do together?' : 'What will you treat them to?'}
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel="Reward"
        />
        <AppText variant="caption" style={{ marginTop: -Spacing.sm }}>
          {shared
            ? 'Something you’ll enjoy together. Either of you can mark it done.'
            : rewardId === 'custom'
            ? 'Keep it a surprise, or type your own reward here to replace it.'
            : rewardId === 'cash'
              ? 'Set the amount. You pay them yourself; no money moves through Sigamos.'
              : 'Real-world rewards only. You’ll mark it delivered once you’ve paid up.'}
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
            {shared ? '+100 XP for both of you when you finish it' : `+100 XP for ${firstName} when they earn it`}
          </AppText>
        </Card>
      </ScrollView>

      <View style={[styles.footer, keyboardHeight > 0 && { paddingBottom: Spacing.md }]}>
        <Button
          title={shared ? `Start challenge with ${firstName}` : `Challenge ${firstName}`}
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
  moreBadge: { position: 'absolute', top: 6, right: 6 },
  moreHint: { fontSize: 11, lineHeight: 13, fontWeight: '700' },
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
