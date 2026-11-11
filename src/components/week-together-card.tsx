import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascots';
import { LeagueChip, XpChip, type LeagueSummary } from '@/components/stat-chips';
import { AppText, Card } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useCrewWeek, useNudge, usePartners, type PartnerState } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import { crewOrder, crewStatus, crewTotals, crewTotalsLine, type CrewStatus } from '@/lib/crew';
import type { Streak } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import { mascotKind } from '@/lib/mascots';
import { buildWeek, DAY_LABELS, type WeekDay, type WeekState } from '@/lib/week';

/** Partners shown in the table; the rest are a tap away on Partners. */
const MAX_ROWS = 3;

/**
 * Home's main card: your streak, then this week for you and the partners who
 * most need you, one row each, with the crew's total and a nudge for whoever
 * is behind. Everything else on Home is a one-line summary under it.
 */
export function WeekTogetherCard({
  streak,
  state,
  xp,
  league,
  myDays,
  myWorkouts,
}: {
  streak: Streak | null;
  state: WeekState;
  xp?: number;
  league?: LeagueSummary;
  myDays: WeekDay[];
  /** Your workouts this week, for the crew's total. */
  myWorkouts: readonly { duration_s: number; counted?: boolean }[];
}) {
  const profile = useProfile();
  const { data: partners, isSuccess } = usePartners();
  const accepted = (partners ?? []).filter((p) => p.status === 'accepted');
  const incoming = (partners ?? []).filter((p) => p.status === 'pending' && p.incoming).length;
  const { data: workouts } = useCrewWeek(accepted.map((p) => p.partner_id));

  const crew = crewOrder(
    accepted.map((member) => {
      const days = buildWeek((workouts ?? []).filter((w) => w.user_id === member.partner_id), 0);
      return { member, days, status: crewStatus(member, days) };
    }),
  );
  const shown = crew.slice(0, MAX_ROWS);
  const more = crew.length - shown.length;
  const toNudge = crew.find((c) => c.status === 'behind' || c.status === 'on-track');

  const weeks = streak?.current_weeks ?? 0;
  const lit = weeks > 0 || state.kind === 'done';
  const myCount = myDays.filter((d) => d.active).length;

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Pressable
          onPress={() => router.push('/streak')}
          accessibilityRole="button"
          accessibilityLabel={`${weeks} week streak`}
          accessibilityHint="Opens your streak and freezes"
          style={({ pressed }) => [styles.streak, pressed && { opacity: 0.7 }]}>
          <SymbolView name="flame.fill" size={30} tintColor={lit ? Colors.flame : Colors.textMuted} />
          <AppText style={[styles.number, !lit && { color: Colors.textMuted }]}>{weeks}</AppText>
          <AppText style={[styles.streakLabel, !lit && { color: Colors.textMuted }]}>week streak</AppText>
        </Pressable>
        <View style={styles.chips}>
          {xp != null && <XpChip xp={xp} compact />}
          {league && <LeagueChip {...league} compact />}
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.row}>
          <AppText variant="label" style={styles.who}>
            This week
          </AppText>
          {DAY_LABELS.map((l, i) => (
            <AppText
              key={i}
              style={[styles.dayLetter, myDays[i]?.isToday && { color: Colors.flame }]}
              accessibilityElementsHidden>
              {l}
            </AppText>
          ))}
          <View style={styles.count} />
        </View>

        <WeekRow
          name="You"
          bold
          mascot={<Mascot kind={mascotKind(profile.mascot)} mood="happy" size={AVATAR} />}
          days={myDays}
          made={myCount}
          goal={profile.weekly_goal}
        />
        {isSuccess &&
          shown.map(({ member, days, status }) => (
            <PartnerRow key={member.partner_id} partner={member} days={days} status={status} />
          ))}
        {isSuccess && !accepted.length && (
          <Pressable
            onPress={() => router.push(incoming ? '/partners' : '/add-partner')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.7 }]}>
            <SymbolView name="plus" size={14} weight="bold" tintColor={Colors.flame} />
            <AppText style={styles.addText}>
              {incoming
                ? `See ${incoming} partner request${incoming === 1 ? '' : 's'}`
                : 'Add a partner to keep each other going'}
            </AppText>
          </Pressable>
        )}
      </View>

      {isSuccess && accepted.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.navigate('/partners')}
            accessibilityRole="button"
            accessibilityHint="Opens Partners"
            style={{ flex: 1 }}>
            <AppText variant="caption" numberOfLines={2}>
              {crewTotalsLine(crewTotals([...myWorkouts, ...(workouts ?? [])]))}
              {more > 0 || incoming > 0 ? (
                <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
                  {more > 0 ? `  +${more} more` : ''}
                  {incoming > 0 ? `  ${incoming} request${incoming === 1 ? '' : 's'}` : ''}
                </AppText>
              ) : null}
            </AppText>
          </Pressable>
          {toNudge && <NudgeButton partner={toNudge.member} />}
        </View>
      )}
    </Card>
  );
}

const AVATAR = 26;

function PartnerRow({ partner, days, status }: { partner: PartnerState; days: WeekDay[]; status: CrewStatus }) {
  const firstName = partner.display_name?.split(' ')[0] ?? 'Partner';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/partner/[id]', params: { id: partner.partner_id } })}
      accessibilityRole="button"
      accessibilityLabel={`${firstName}, ${partner.this_week_days} of ${partner.this_week_goal} days this week`}
      accessibilityHint="Opens their profile"
      style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <WeekRow
        name={firstName}
        mascot={
          <Mascot kind={mascotKind(partner.mascot)} mood={status === 'resting' ? 'sleepy' : 'happy'} size={AVATAR} />
        }
        days={days}
        made={partner.this_week_days}
        goal={partner.this_week_goal}
        resting={status === 'resting'}
      />
    </Pressable>
  );
}

function WeekRow({
  name,
  mascot,
  days,
  made,
  goal,
  bold = false,
  resting = false,
}: {
  name: string;
  mascot: ReactNode;
  days: WeekDay[];
  made: number;
  goal: number;
  bold?: boolean;
  resting?: boolean;
}) {
  const done = made >= goal;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${name}, ${made} of ${goal} days this week`}>
      <View style={styles.who}>
        {mascot}
        <AppText numberOfLines={1} style={[styles.name, bold && { fontWeight: '700' }]}>
          {name}
        </AppText>
      </View>
      {days.map((d) => (
        <View key={d.key} style={styles.cell}>
          <View
            style={[
              styles.dot,
              d.active && styles.dotActive,
              d.isToday && !d.active && styles.dotToday,
              d.isFuture && { opacity: 0.45 },
            ]}
          />
        </View>
      ))}
      <AppText
        style={[styles.countText, { color: done ? Colors.success : resting ? Colors.rest : Colors.textSecondary }]}>
        {resting ? 'Rest' : `${made}/${goal}`}
      </AppText>
    </View>
  );
}

function NudgeButton({ partner }: { partner: PartnerState }) {
  const nudge = useNudge();
  const firstName = partner.display_name?.split(' ')[0] ?? 'them';
  const done = partner.recently_nudged;
  return (
    <Pressable
      disabled={done || nudge.isPending}
      onPress={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        nudge.mutate(partner.partner_id, { onError: (e) => Alert.alert('Couldn’t nudge', friendlyError(e)) });
      }}
      accessibilityRole="button"
      accessibilityLabel={done ? `Nudged ${firstName}` : `Nudge ${firstName}`}
      style={({ pressed }) => [styles.nudge, (pressed || done) && { opacity: 0.6 }]}>
      <AppText numberOfLines={1} style={styles.nudgeText}>
        {done ? `Nudged ${firstName}` : `👋 Nudge ${firstName}`}
      </AppText>
    </Pressable>
  );
}

const DOT = 20;

const styles = StyleSheet.create({
  card: { gap: Spacing.sm + 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  streak: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  number: {
    fontFamily: Font.rounded,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
    color: Colors.flame,
    fontVariant: ['tabular-nums'],
  },
  streakLabel: { fontFamily: Font.rounded, fontSize: 16, fontWeight: '800', color: Colors.flame, marginTop: 6 },
  chips: { alignItems: 'flex-end', gap: 4 },
  table: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  who: { width: 96, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 14, color: Colors.text },
  dayLetter: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  cell: { flex: 1, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: Colors.cardRaised },
  dotActive: { backgroundColor: Colors.flame },
  dotToday: { borderWidth: 2, borderColor: Colors.flame, backgroundColor: 'transparent' },
  count: { width: 36 },
  countText: { width: 36, textAlign: 'right', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.flame,
  },
  addText: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.flame },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  nudge: {
    minHeight: 40,
    maxWidth: 170,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.flameSoft,
  },
  nudgeText: { fontSize: 14, fontWeight: '700', color: Colors.flame },
});
