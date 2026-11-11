import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText, Button, Card, Segmented, SectionLabel } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useSafetyMenu } from '@/hooks/use-safety';
import { useXpThisWeekByKind } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { useGroupBoard, useLeaveGroup, useMyGroups, useRemoveGroupMember, useUpdateGroup } from '@/hooks/use-groups';
import type { GroupMemberRow, MyGroup } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import { climbLine, crownHolder, groupInviteMessage, madeIt, podium, podiumWeek, showPodium, squadLine } from '@/lib/groups';
import { markPodiumSeen, podiumSeen } from '@/lib/podium-seen';
import { XP_RULES, xpBreakdown } from '@/lib/xp-rules';
import { MEDALS } from '@/lib/leagues';
import { treats } from '@/lib/treats';

type Tab = 'board' | 'squad';

/**
 * A private group: this week's leaderboard (medals, and a crown for last
 * week's winner) and the squad streak everyone keeps alive together.
 */
export default function GroupScreen() {
  // ?tab=squad opens the Squad tab (links and the App Store screenshot script).
  const { id, created, tab: startTab } = useLocalSearchParams<{ id: string; created?: string; tab?: string }>();
  const { data: groups, isPending } = useMyGroups();
  const group = groups?.find((g) => g.id === id);
  const { data: rows } = useGroupBoard(id);
  const [tab, setTab] = useState<Tab>(startTab === 'squad' ? 'squad' : 'board');
  useMedalCeremony(id, rows);

  if (!group) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Group' }} />
        {isPending ? (
          <ActivityIndicator color={Colors.flame} />
        ) : (
          <AppText variant="body" color={Colors.textSecondary}>
            You’re not in this group anymore.
          </AppText>
        )}
      </View>
    );
  }

  const invite = () => Share.share({ message: groupInviteMessage(group) });
  const alone = group.member_count < 2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: group.name }} />
      <Card style={styles.header}>
        <AppText style={styles.headerEmoji}>{group.emoji}</AppText>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {group.name}
        </AppText>
        <AppText variant="caption">
          {group.member_count} {group.member_count === 1 ? 'person' : 'people'} · code{' '}
          <AppText variant="caption" color={Colors.text} style={{ fontWeight: '700', letterSpacing: 1 }} selectable>
            {group.invite_code}
          </AppText>
        </AppText>
        <View style={styles.headerActions}>
          <Button
            title="📨 Invite"
            variant={created === '1' || alone ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
            onPress={invite}
          />
          {group.role === 'owner' && <EditButton group={group} />}
        </View>
        {alone && (
          <AppText variant="caption" style={{ textAlign: 'center' }}>
            Send the invite to friends, family or coworkers. Groups come alive with 3 or more.
          </AppText>
        )}
      </Card>

      <Segmented
        options={[
          { key: 'board', label: 'Leaderboard' },
          { key: 'squad', label: `Squad 🔥 ${group.squad_streak}` },
        ]}
        value={tab}
        onChange={setTab}
        size="large"
      />

      {!rows ? (
        <ActivityIndicator color={Colors.flame} />
      ) : tab === 'board' ? (
        <Leaderboard group={group} rows={rows} />
      ) : (
        <Squad group={group} rows={rows} />
      )}

      <LeaveButton group={group} />
    </ScrollView>
  );
}

function Leaderboard({ group, rows }: { group: MyGroup; rows: GroupMemberRow[] }) {
  const crown = crownHolder(rows);
  const remove = useRemoveGroupMember();
  const safety = useSafetyMenu();

  const confirmRemove = (r: GroupMemberRow) =>
    Alert.alert(`Remove ${r.name}?`, 'They’ll leave the group. They can rejoin with the code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(
            { group: group.id, user: r.user_id },
            { onError: (e) => Alert.alert('Couldn’t remove', friendlyError(e)) },
          ),
      },
    ]);

  return (
    <>
      {showPodium(new Date()) && <LastWeekPodium groupId={group.id} rows={rows} />}
      <SectionLabel>This week’s treats</SectionLabel>
      <Card style={{ gap: 2, paddingHorizontal: Spacing.sm }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.user_id}
            onLongPress={
              r.is_me
                ? undefined
                : () =>
                    safety({
                      userId: r.user_id,
                      name: r.name,
                      kind: 'user',
                      extra:
                        group.role === 'owner'
                          ? { label: 'Remove from group', onPress: () => confirmRemove(r) }
                          : undefined,
                    })
            }
            delayLongPress={400}
            accessibilityLabel={`${i + 1}. ${r.name}${r.is_me ? ' (you)' : ''}, ${treats(r.xp)}${r.user_id === crown ? ', last week’s winner' : ''}`}
            style={[styles.row, r.is_me && styles.meRow]}>
            <AppText style={styles.rank}>{r.xp > 0 && MEDALS[i] ? MEDALS[i] : i + 1}</AppText>
            <Avatar id={r.user_id} name={r.name} size={36} photoPath={r.avatar_url} />
            <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {r.is_me ? `${r.name} (you)` : r.name}
              {r.user_id === crown ? ' 👑' : ''}
            </AppText>
            <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
              {treats(r.xp)}
            </AppText>
          </Pressable>
        ))}
      </Card>
      <AppText variant="caption" style={styles.note}>
        Resets every Sunday. 👑 marks last week’s winner.
        {group.role === 'owner'
          ? ' Press and hold someone to remove, report or block them.'
          : ' Press and hold someone to report or block them.'}
      </AppText>
      <HowToEarn rows={rows} />
    </>
  );
}

/**
 * What gets you XP on this board: your own XP this week by source, the gap to
 * the next person up, and (tap to open) every way to earn it.
 */
function HowToEarn({ rows }: { rows: GroupMemberRow[] }) {
  const { data: byKind } = useXpThisWeekByKind();
  const [open, setOpen] = useState(false);
  const mine = xpBreakdown(byKind ?? {});
  const total = mine.reduce((sum, k) => sum + k.xp, 0);
  const climb = climbLine(rows);

  return (
    <Card style={{ gap: Spacing.sm }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Shows what earns treats on this board"
        style={styles.earnHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">⚡ How to earn treats</AppText>
          {climb && <AppText variant="caption">{climb}</AppText>}
        </View>
        <AppText variant="heading" color={Colors.textSecondary}>
          {open ? '−' : '+'}
        </AppText>
      </Pressable>

      {mine.length > 0 && (
        <View style={styles.chips}>
          {mine.map((k) => (
            <View key={k.kind} style={styles.chip}>
              <AppText variant="caption" color={Colors.text}>
                {k.emoji} {k.label} {k.xp}
              </AppText>
            </View>
          ))}
        </View>
      )}
      <AppText variant="caption">
        {total > 0
          ? `Your ${treats(total)} this week, by what earned it.`
          : 'No treats yet this week. A workout is the quickest way onto the board.'}
      </AppText>

      {open && (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.xs }}>
          {XP_RULES.map((r) => (
            <View key={r.what} style={styles.earnRow}>
              <AppText style={{ width: 24, textAlign: 'center' }}>{r.emoji}</AppText>
              <AppText variant="body" style={{ flex: 1 }}>
                {r.what}
              </AppText>
              <AppText variant="heading" color={Colors.xp}>
                {r.xp}
              </AppText>
            </View>
          ))}
          <AppText variant="caption">
            They’re your own treats, so the same ones count in every group you’re in and in the weekly league. The squad
            streak is separate: it only needs everyone to hit their own weekly goal.
          </AppText>
          <Pressable onPress={() => router.push('/xp')} hitSlop={8} accessibilityRole="button">
            <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
              More on treats and levels →
            </AppText>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

/**
 * The medal ceremony plays once per group and finished week: the first time you
 * open the group after the week ends, if anyone earned XP last week.
 */
function useMedalCeremony(groupId: string, rows: GroupMemberRow[] | undefined) {
  const userId = useAuth().session?.user.id;
  const hasPodium = !!rows && rows.length >= 2 && podium(rows).length > 0;
  useEffect(() => {
    if (!userId || !hasPodium) return;
    const week = podiumWeek(new Date());
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    podiumSeen(userId, groupId, week).then((seen) => {
      if (seen || cancelled) return;
      // A beat after the group screen appears, so the ceremony reads as its own moment.
      timer = setTimeout(() => {
        markPodiumSeen(userId, groupId, week);
        router.push({ pathname: '/group/podium/[id]', params: { id: groupId } });
      }, 400);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, groupId, hasPodium]);
}

/** Last week's medalists, shown on Sunday and Monday (the same podium as the Sunday push). */
function LastWeekPodium({ groupId, rows }: { groupId: string; rows: GroupMemberRow[] }) {
  const places = podium(rows);
  if (rows.length < 2 || places.length === 0) return null;
  const avatar = (id: string) => rows.find((r) => r.user_id === id)?.avatar_url ?? null;
  return (
    <>
      <View style={styles.podiumHeader}>
        <SectionLabel>Last week’s podium</SectionLabel>
        <Pressable
          onPress={() => router.push({ pathname: '/group/podium/[id]', params: { id: groupId } })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Replay the medal ceremony"
          style={{ marginTop: Spacing.sm }}>
          <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
            ▶ Replay
          </AppText>
        </Pressable>
      </View>
      <Card style={[{ gap: 2, paddingHorizontal: Spacing.sm }, styles.podium]}>
        {places.map((p) => (
          <View
            key={p.user_id}
            accessible
            accessibilityLabel={`${['Gold', 'Silver', 'Bronze'][p.medal]}: ${p.is_me ? 'you' : p.name}, ${treats(p.xp)}`}
            style={[styles.row, p.is_me && styles.meRow]}>
            <AppText style={[styles.rank, { fontSize: 22, lineHeight: 28 }]}>{MEDALS[p.medal]}</AppText>
            <Avatar id={p.user_id} name={p.name} size={36} photoPath={avatar(p.user_id)} />
            <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {p.is_me ? `${p.name} (you)` : p.name}
            </AppText>
            <AppText variant="heading" color={Colors.xp} style={{ fontVariant: ['tabular-nums'] }}>
              {treats(p.xp)}
            </AppText>
          </View>
        ))}
      </Card>
    </>
  );
}

function Squad({ group, rows }: { group: MyGroup; rows: GroupMemberRow[] }) {
  const progress = group.need ? Math.min(group.made / group.need, 1) : 0;
  const done = group.made >= group.need && group.member_count >= 2;
  return (
    <>
      <Card style={styles.squadHero}>
        <AppText style={[styles.squadNumber, { color: group.squad_streak > 0 ? Colors.flame : Colors.textMuted }]}>
          🔥 {group.squad_streak}
        </AppText>
        <AppText variant="heading" color={Colors.flame}>
          week squad streak
        </AppText>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }, done && { backgroundColor: Colors.success }]} />
        </View>
        <AppText variant="heading" color={done ? Colors.success : Colors.text} style={{ textAlign: 'center' }}>
          {squadLine(group)}
        </AppText>
        {group.member_count >= 2 && (
          <AppText variant="caption">
            {group.made} of {group.need} goals made this week
          </AppText>
        )}
      </Card>

      <SectionLabel>Who’s made it</SectionLabel>
      <Card style={{ gap: 2, paddingHorizontal: Spacing.sm }}>
        {[...rows]
          .sort((a, b) => Number(madeIt(b)) - Number(madeIt(a)) || a.name.localeCompare(b.name))
          .map((r) => {
            const made = madeIt(r);
            return (
              <View key={r.user_id} style={[styles.row, r.is_me && styles.meRow]}>
                <Avatar id={r.user_id} name={r.name} size={36} photoPath={r.avatar_url} />
                <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                  {r.is_me ? `${r.name} (you)` : r.name}
                </AppText>
                <AppText variant="heading" color={made ? Colors.success : Colors.textSecondary}>
                  {made ? '✅ Made it' : r.week_status === 'rest' ? '😴 Resting' : `${r.this_week_days}/${r.this_week_goal} days`}
                </AppText>
              </View>
            );
          })}
      </Card>
      <AppText variant="caption" style={styles.note}>
        The squad week counts when at least 80% of the group hits their own weekly goal (everyone, in groups
        of 4 or fewer). A rest week or a streak freeze counts too.
      </AppText>
    </>
  );
}

function EditButton({ group }: { group: MyGroup }) {
  const update = useUpdateGroup();
  return (
    <Button
      title="✏️ Rename"
      variant="secondary"
      style={{ flex: 1 }}
      loading={update.isPending}
      onPress={() =>
        Alert.prompt(
          'Rename the group',
          undefined,
          (value) => {
            const name = value.trim();
            if (name.length < 2 || name === group.name) return;
            update.mutate(
              { id: group.id, name, emoji: group.emoji },
              { onError: (e) => Alert.alert('Couldn’t rename', friendlyError(e)) },
            );
          },
          'plain-text',
          group.name,
        )
      }
    />
  );
}

function LeaveButton({ group }: { group: MyGroup }) {
  const leave = useLeaveGroup();
  const last = group.member_count <= 1;
  return (
    <Pressable
      onPress={() =>
        Alert.alert(
          `Leave ${group.name}?`,
          last
            ? 'You’re the last one, so the group will be deleted.'
            : group.role === 'owner'
              ? 'Whoever has been in the group longest becomes its owner.'
              : 'You can rejoin later with the code.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: last ? 'Leave and delete' : 'Leave',
              style: 'destructive',
              onPress: () =>
                leave.mutate(group.id, {
                  onSuccess: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    router.back();
                  },
                  onError: (e) => Alert.alert('Couldn’t leave', friendlyError(e)),
                }),
            },
          ],
        )
      }
      hitSlop={8}
      accessibilityRole="button"
      style={styles.leave}>
      <AppText variant="caption" color={Colors.danger} style={{ fontWeight: '700' }}>
        Leave group
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  header: { alignItems: 'center', gap: Spacing.xs },
  headerEmoji: { fontSize: 56, lineHeight: 68 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch', marginTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
  },
  meRow: { backgroundColor: Colors.flameSoft },
  podium: { borderWidth: 1, borderColor: Colors.xpSoft },
  earnHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.xpSoft,
  },
  podiumHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: Spacing.xs },
  rank: { width: 28, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '800', color: Colors.textSecondary },
  note: { marginHorizontal: Spacing.xs },
  squadHero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  squadNumber: { fontFamily: Font.rounded, fontSize: 52, lineHeight: 60, fontWeight: '900' },
  bar: {
    alignSelf: 'stretch',
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.cardRaised,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  barFill: { height: '100%', borderRadius: 6, backgroundColor: Colors.flame },
  leave: { alignSelf: 'center', paddingVertical: Spacing.md },
});
