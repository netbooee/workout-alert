import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText, Button, Card, Segmented, SectionLabel } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useSafetyMenu } from '@/hooks/use-safety';
import { useGroupBoard, useLeaveGroup, useMyGroups, useRemoveGroupMember, useUpdateGroup } from '@/hooks/use-groups';
import type { GroupMemberRow, MyGroup } from '@/lib/database.types';
import { friendlyError } from '@/lib/errors';
import { crownHolder, groupInviteMessage, madeIt, squadLine } from '@/lib/groups';
import { MEDALS } from '@/lib/leagues';

type Tab = 'board' | 'squad';

/**
 * A private group: this week's leaderboard (medals, and a crown for last
 * week's winner) and the squad streak everyone keeps alive together.
 */
export default function GroupScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { data: groups, isPending } = useMyGroups();
  const group = groups?.find((g) => g.id === id);
  const { data: rows } = useGroupBoard(id);
  const [tab, setTab] = useState<Tab>('board');

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
      <SectionLabel>This week’s XP</SectionLabel>
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
            accessibilityLabel={`${i + 1}. ${r.name}${r.is_me ? ' (you)' : ''}, ${r.xp} XP${r.user_id === crown ? ', last week’s winner' : ''}`}
            style={[styles.row, r.is_me && styles.meRow]}>
            <AppText style={styles.rank}>{r.xp > 0 && MEDALS[i] ? MEDALS[i] : i + 1}</AppText>
            <Avatar id={r.user_id} name={r.name} size={36} photoPath={r.avatar_url} />
            <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {r.is_me ? `${r.name} (you)` : r.name}
              {r.user_id === crown ? ' 👑' : ''}
            </AppText>
            <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
              {r.xp} XP
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
