import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Mascot } from '@/components/mascots';
import { AppText, Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCrewWeek, useNudge, usePartners, type PartnerState } from '@/hooks/use-social';
import { CREW_BADGE, crewLine, crewOrder, crewStatus, type CrewStatus } from '@/lib/crew';
import { friendlyError } from '@/lib/errors';
import { mascotKind } from '@/lib/mascots';
import { buildWeek, DAY_LABELS, type WeekDay } from '@/lib/week';

const RING = 64;
const STROKE = 4;

/**
 * Your partners on Home (after Ladder's "teammates working out" row and
 * Finch's goal-buddy week): each buddy in a ring that fills with their week,
 * with a status badge. Tap one to compare this week side by side, with a nudge.
 * With no partners yet, empty slots invite you to add one.
 */
export function CrewCard({ myDays }: { myDays: WeekDay[] }) {
  const { data: partners, isSuccess } = usePartners();
  const accepted = (partners ?? []).filter((p) => p.status === 'accepted');
  const incoming = (partners ?? []).filter((p) => p.status === 'pending' && p.incoming).length;
  const { data: workouts } = useCrewWeek(accepted.map((p) => p.partner_id));
  const [picked, setPicked] = useState<string | null>(null);

  if (!isSuccess) return null;
  if (!accepted.length) return <EmptyCrew incoming={incoming} />;

  const crew = crewOrder(
    accepted.map((member) => {
      const days = buildWeek((workouts ?? []).filter((w) => w.user_id === member.partner_id), 0);
      return { member, days, status: crewStatus(member, days) };
    }),
  );
  const selected = crew.find((c) => c.member.partner_id === picked) ?? crew[0]!;

  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={styles.header}>
        <AppText variant="label">Your crew</AppText>
        <Pressable onPress={() => router.push('/partners')} hitSlop={10} accessibilityRole="button">
          <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
            {incoming ? `${incoming} request${incoming === 1 ? '' : 's'} · ` : ''}See all ›
          </AppText>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {crew.map(({ member, status }) => (
          <CrewBuddy
            key={member.partner_id}
            partner={member}
            status={status}
            selected={member.partner_id === selected.member.partner_id}
            onPress={() => {
              Haptics.selectionAsync();
              setPicked(member.partner_id);
            }}
          />
        ))}
        <Pressable
          onPress={() => router.push('/add-partner')}
          accessibilityRole="button"
          accessibilityLabel="Add a partner"
          style={styles.member}>
          <View style={[styles.ringBox, styles.addSlot]}>
            <SymbolView name="plus" size={22} weight="semibold" tintColor={Colors.flame} />
          </View>
          <AppText variant="caption" style={styles.name}>
            Add
          </AppText>
        </Pressable>
      </ScrollView>

      <Compare partner={selected.member} status={selected.status} theirDays={selected.days} myDays={myDays} />
    </Card>
  );
}

function CrewBuddy({
  partner,
  status,
  selected,
  onPress,
}: {
  partner: PartnerState;
  status: CrewStatus;
  selected: boolean;
  onPress: () => void;
}) {
  const firstName = partner.display_name?.split(' ')[0] ?? 'Partner';
  const progress = Math.min(partner.this_week_days / Math.max(partner.this_week_goal, 1), 1);
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const badge = CREW_BADGE[status];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${firstName}, ${partner.this_week_days} of ${partner.this_week_goal} days this week`}
      style={styles.member}>
      <View style={[styles.ringBox, selected && styles.ringSelected]}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={Colors.cardRaised} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={status === 'done' ? Colors.success : Colors.flame}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            fill="none"
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <Mascot kind={mascotKind(partner.mascot)} mood={status === 'resting' ? 'sleepy' : 'happy'} size={44} />
        {badge && (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{badge}</AppText>
          </View>
        )}
      </View>
      <AppText
        variant="caption"
        numberOfLines={1}
        color={selected ? Colors.text : Colors.textSecondary}
        style={[styles.name, selected && { fontWeight: '800' }]}>
        {firstName}
      </AppText>
      <AppText variant="caption" style={styles.count}>
        {partner.this_week_days}/{partner.this_week_goal}
      </AppText>
    </Pressable>
  );
}

/** You and the picked partner, this week, one row each. */
function Compare({
  partner,
  status,
  theirDays,
  myDays,
}: {
  partner: PartnerState;
  status: CrewStatus;
  theirDays: WeekDay[];
  myDays: WeekDay[];
}) {
  const nudge = useNudge();
  const firstName = partner.display_name?.split(' ')[0] ?? 'Partner';
  const canNudge = status === 'behind' || status === 'on-track';

  return (
    <View style={styles.compare}>
      <View style={styles.weekRow}>
        <View style={styles.rowLabel} />
        {DAY_LABELS.map((l, i) => (
          <AppText key={i} variant="caption" style={styles.dayLetter}>
            {l}
          </AppText>
        ))}
      </View>
      <WeekRow label="You" days={myDays} />
      <WeekRow label={firstName} days={theirDays} />

      <AppText variant="body">{crewLine(status, firstName, partner)}</AppText>
      {partner.friend_streak > 0 && (
        <AppText variant="caption" color={Colors.text}>
          🤝 {partner.friend_streak} week{partner.friend_streak === 1 ? '' : 's'} together
        </AppText>
      )}

      <View style={styles.actions}>
        {canNudge && (
          <Pressable
            disabled={partner.recently_nudged || nudge.isPending}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              nudge.mutate(partner.partner_id, { onError: (e) => Alert.alert('Could not nudge', friendlyError(e)) });
            }}
            accessibilityRole="button"
            accessibilityLabel={partner.recently_nudged ? `Nudged ${firstName}` : `Nudge ${firstName}`}
            style={({ pressed }) => [styles.action, styles.nudge, (pressed || partner.recently_nudged) && { opacity: 0.6 }]}>
            <AppText style={[styles.actionText, { color: Colors.flame }]}>
              {partner.recently_nudged ? 'Nudged 👋' : '👋 Nudge'}
            </AppText>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push({ pathname: '/partner/[id]', params: { id: partner.partner_id } })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${firstName}’s profile`}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
          <AppText style={styles.actionText}>Profile ›</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function WeekRow({ label, days }: { label: string; days: WeekDay[] }) {
  return (
    <View style={styles.weekRow}>
      <AppText variant="caption" numberOfLines={1} color={Colors.text} style={[styles.rowLabel, { fontWeight: '700' }]}>
        {label}
      </AppText>
      {days.map((d) => (
        <View key={d.key} style={styles.dayCell}>
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
    </View>
  );
}

/** No partners yet: empty slots that each add one, after Noom's "Stay on track together". */
function EmptyCrew({ incoming }: { incoming: number }) {
  return (
    <Card style={{ gap: Spacing.md }}>
      <AppText variant="label">Your crew</AppText>
      <AppText variant="heading">Workouts are easier together</AppText>
      <AppText variant="caption">
        Add a partner to see each other’s weeks, cheer each other on and keep a streak together.
      </AppText>
      <View style={styles.strip}>
        {[0, 1, 2].map((i) => (
          <Pressable
            key={i}
            onPress={() => router.push('/add-partner')}
            accessibilityRole="button"
            accessibilityLabel="Add a partner"
            style={styles.member}>
            <View style={[styles.ringBox, styles.addSlot]}>
              <SymbolView name="plus" size={22} weight="semibold" tintColor={Colors.flame} />
            </View>
          </Pressable>
        ))}
      </View>
      {incoming > 0 ? (
        <Button
          title={`See ${incoming} partner request${incoming === 1 ? '' : 's'}`}
          onPress={() => router.push('/partners')}
        />
      ) : (
        <Button title="Add a partner" onPress={() => router.push('/add-partner')} />
      )}
    </Card>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strip: { flexDirection: 'row', gap: Spacing.md, paddingVertical: 2 },
  member: { alignItems: 'center', width: RING + 6, gap: 2 },
  ringBox: { width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' },
  ringSelected: { backgroundColor: Colors.flameSoft },
  addSlot: { borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.flame },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  badgeText: { fontSize: 14, lineHeight: 18 },
  name: { fontSize: 12, lineHeight: 15, maxWidth: RING + 6 },
  count: { fontSize: 11, lineHeight: 13 },
  compare: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
  },
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { width: 64 },
  dayLetter: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 11 },
  dayCell: { flex: 1, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: Colors.card },
  dotActive: { backgroundColor: Colors.flame },
  dotToday: { borderWidth: 2, borderColor: Colors.flame },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  action: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
  },
  nudge: { backgroundColor: Colors.flameSoft },
  actionText: { fontSize: 16, lineHeight: 20, fontWeight: '700', color: Colors.text },
});
