import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarWithBuddy, BuddyChip } from '@/components/buddy-avatar';
import { Mascot } from '@/components/mascots';
import { AppText, Card, SectionLabel } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyChats, useSetChatMuted } from '@/hooks/use-chat';
import { useSafetyMenu } from '@/hooks/use-safety';
import { useXpThisWeekByKind } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { useGroupBoard, useLeaveGroup, useMyGroups, useRemoveGroupMember, useUpdateGroup } from '@/hooks/use-groups';
import type { ChatSummary, GroupMemberRow, MyGroup } from '@/lib/database.types';
import { previewLine } from '@/lib/chat';
import { friendlyError } from '@/lib/errors';
import {
  climbLine,
  crownHolder,
  groupInviteMessage,
  madeIt,
  MAX_GROUP_SIZE,
  podium,
  podiumWeek,
  raceTrack,
  showPodium,
  squadLine,
} from '@/lib/groups';
import { markPodiumSeen, podiumSeen } from '@/lib/podium-seen';
import { XP_RULES, xpBreakdown } from '@/lib/xp-rules';
import { MEDALS } from '@/lib/leagues';
import { mascotKind } from '@/lib/mascots';
import { treats } from '@/lib/treats';

/**
 * A private group: everyone's buddy and the squad week up top, this week's
 * leaderboard (medals, and a crown for last week's winner) below, and the
 * group chat pinned to the bottom. Rename, chat alerts and leaving are in •••.
 */
export default function GroupScreen() {
  const { id, created } = useLocalSearchParams<{
    id: string;
    created?: string;
  }>();
  const { data: groups, isPending } = useMyGroups();
  const group = groups?.find((g) => g.id === id);
  const { data: rows } = useGroupBoard(id);
  const chat = useMyChats().data?.find((c) => c.group_id === id);
  const openMenu = useGroupMenu(group, !!chat?.muted);
  const insets = useSafeAreaInsets();
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
  const openChat = () => router.push({ pathname: '/group/chat/[id]', params: { id: group.id } });

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${group.emoji} ${group.name}`,
          headerRight: () => (
            <Pressable
              onPress={openMenu}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Group options"
              style={styles.more}>
              <SymbolView name="ellipsis" size={18} tintColor={Colors.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: CHAT_BAR + insets.bottom + Spacing.lg }]}>
        {!rows ? (
          <ActivityIndicator color={Colors.flame} />
        ) : (
          <>
            <SquadBuddies group={group} rows={rows} onInvite={invite} highlightInvite={created === '1'} />
            <Leaderboard group={group} rows={rows} />
          </>
        )}
      </ScrollView>
      <ChatBar chat={chat} groupName={group.name} onPress={openChat} bottom={insets.bottom} />
    </View>
  );
}

const CHAT_BAR = 58;
const BUDDY = 48;

/**
 * Everyone's buddy in a row (it scrolls in big groups), each showing where
 * they are this week: proud when they've made it, napping on a rest week,
 * otherwise how many days to go. Then the squad week's progress.
 */
function SquadBuddies({
  group,
  rows,
  onInvite,
  highlightInvite,
}: {
  group: MyGroup;
  rows: GroupMemberRow[];
  onInvite: () => void;
  highlightInvite: boolean;
}) {
  const people = [...rows].sort((a, b) => Number(b.is_me) - Number(a.is_me) || a.name.localeCompare(b.name));
  const alone = group.member_count < 2;
  const done = !alone && group.made >= group.need;
  const segments = Math.max(group.need, 1);

  const explain = () =>
    Alert.alert(
      'Squad streak',
      'The squad week counts when at least 80% of the group hits their own weekly goal (everyone, in groups of 4 or fewer). A rest week or a streak freeze counts too.',
    );

  return (
    <Card style={styles.squad}>
      <Pressable
        onPress={explain}
        accessibilityRole="button"
        accessibilityHint="Explains the squad streak"
        style={styles.squadTitle}>
        <AppText variant="heading" style={{ flex: 1 }}>
          {group.squad_streak > 0 ? `🔥 ${group.squad_streak}-week squad streak` : 'Start a squad streak'}
        </AppText>
        {!alone && (
          <AppText variant="caption" color={done ? Colors.success : Colors.textSecondary} style={{ fontWeight: '700' }}>
            {group.made} of {group.need} goals
          </AppText>
        )}
        <SymbolView name="info.circle" size={16} tintColor={Colors.textMuted} />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buddies}>
        {people.map((r) => {
          const made = madeIt(r);
          const resting = !made && r.week_status === 'rest';
          const left = Math.max(r.this_week_goal - r.this_week_days, 0);
          const status = made ? 'Done' : resting ? 'Resting' : `${left} to go`;
          const spoken = made
            ? 'made the week'
            : resting
              ? 'resting this week'
              : `${left} ${left === 1 ? 'day' : 'days'} to go`;
          return (
            <View
              key={r.user_id}
              accessible
              accessibilityLabel={`${r.is_me ? 'You' : r.name}: ${spoken}`}
              style={styles.buddy}>
              <View style={[styles.buddyFace, made && styles.buddyFaceDone]}>
                <Mascot
                  kind={mascotKind(r.mascot)}
                  mood={made ? 'blazing' : resting ? 'sleepy' : 'ready'}
                  size={BUDDY}
                />
              </View>
              <AppText variant="caption" color={Colors.text} numberOfLines={1} style={styles.buddyName}>
                {r.is_me ? 'You' : r.name}
              </AppText>
              <AppText
                variant="caption"
                numberOfLines={1}
                color={made ? Colors.success : Colors.textSecondary}
                style={styles.buddyStatus}>
                {status}
              </AppText>
            </View>
          );
        })}
        {group.member_count < MAX_GROUP_SIZE && (
          <Pressable
            onPress={onInvite}
            accessibilityRole="button"
            accessibilityLabel="Invite someone"
            style={styles.buddy}>
            <View style={[styles.inviteSlot, (alone || highlightInvite) && styles.inviteSlotHot]}>
              <SymbolView
                name="plus"
                size={20}
                weight="bold"
                tintColor={alone || highlightInvite ? Colors.flame : Colors.textSecondary}
              />
            </View>
            <AppText variant="caption" color={Colors.textSecondary} style={styles.buddyName}>
              Invite
            </AppText>
          </Pressable>
        )}
      </ScrollView>

      {alone ? (
        <AppText variant="caption">
          Send the invite to friends, family or coworkers. Groups come alive with 3 or more.
        </AppText>
      ) : (
        <>
          <View style={styles.segments} accessible accessibilityLabel={`${group.made} of ${group.need} goals made`}>
            {Array.from({ length: segments }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i < group.made && {
                    backgroundColor: done ? Colors.success : Colors.flame,
                  },
                ]}
              />
            ))}
          </View>
          <AppText variant="body" color={done ? Colors.success : Colors.text} style={{ fontWeight: '600' }}>
            {squadLine(group)}
          </AppText>
        </>
      )}
    </Card>
  );
}

/** The group chat, pinned under everything: the newest message and how many are new. */
function ChatBar({
  chat,
  groupName,
  onPress,
  bottom,
}: {
  chat: ChatSummary | undefined;
  groupName: string;
  onPress: () => void;
  bottom: number;
}) {
  const unread = chat?.unread ?? 0;
  const preview = chat?.last_kind ? previewLine(chat) : `Message ${groupName}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open the group chat. ${preview}${unread ? `. ${unread} new` : ''}`}
      style={({ pressed }) => [styles.chatBar, { bottom: bottom + Spacing.sm }, pressed && { opacity: 0.85 }]}>
      <AppText
        variant="body"
        numberOfLines={1}
        color={chat?.last_kind ? Colors.text : Colors.textMuted}
        style={{ flex: 1, fontSize: 15, fontWeight: unread ? '700' : '400' }}>
        {preview}
      </AppText>
      {unread > 0 && (
        <View style={styles.unread}>
          <AppText style={styles.unreadText} color="#000">
            {unread > 99 ? '99+' : unread}
          </AppText>
        </View>
      )}
      <View style={styles.send}>
        <SymbolView name="paperplane.fill" size={17} tintColor="#000" />
      </View>
    </Pressable>
  );
}

/** The ••• menu: share the invite, rename (owner), chat alerts, leave. */
function useGroupMenu(group: MyGroup | undefined, muted: boolean) {
  const update = useUpdateGroup();
  const leave = useLeaveGroup();
  const setMuted = useSetChatMuted(group?.id ?? '');

  return () => {
    if (!group) return;
    const owner = group.role === 'owner';
    const rename = () =>
      Alert.prompt(
        'Rename the group',
        undefined,
        (value) => {
          const name = value.trim();
          if (name.length < 2 || name === group.name) return;
          update.mutate(
            { id: group.id, name, emoji: group.emoji },
            {
              onError: (e) => Alert.alert('Couldn’t rename', friendlyError(e)),
            },
          );
        },
        'plain-text',
        group.name,
      );
    const confirmLeave = () => {
      const last = group.member_count <= 1;
      Alert.alert(
        `Leave ${group.name}?`,
        last
          ? 'You’re the last one, so the group will be deleted.'
          : owner
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
      );
    };

    const items: { label: string; run: () => void; destructive?: boolean }[] = [
      {
        label: 'Share invite',
        run: () => Share.share({ message: groupInviteMessage(group) }),
      },
      ...(owner ? [{ label: 'Rename group', run: rename }] : []),
      {
        label: muted ? 'Turn on chat alerts' : 'Turn off chat alerts',
        run: () =>
          setMuted.mutate(!muted, {
            onError: (e) => Alert.alert('Couldn’t change that', friendlyError(e)),
          }),
      },
      { label: 'Leave group', run: confirmLeave, destructive: true },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Invite code ${group.invite_code}`,
        message: owner
          ? 'Press and hold someone on the leaderboard to remove, report or block them.'
          : 'Press and hold someone on the leaderboard to report or block them.',
        options: [...items.map((i) => i.label), 'Cancel'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: items.findIndex((i) => i.destructive),
      },
      (i) => items[i]?.run(),
    );
  };
}

function Leaderboard({ group, rows }: { group: MyGroup; rows: GroupMemberRow[] }) {
  const crown = crownHolder(rows);
  const climb = climbLine(rows);
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
            {
              onError: (e) => Alert.alert('Couldn’t remove', friendlyError(e)),
            },
          ),
      },
    ]);

  return (
    <>
      {showPodium(new Date()) && <LastWeekPodium groupId={group.id} rows={rows} />}
      <View style={styles.boardHeader}>
        <SectionLabel>This week’s treats</SectionLabel>
        <AppText variant="caption" style={{ marginTop: Spacing.sm }}>
          Resets Sunday
        </AppText>
      </View>
      <Card style={{ gap: 2, paddingHorizontal: Spacing.sm }}>
        {climb && (
          <AppText variant="heading" style={styles.climb}>
            {climb}
          </AppText>
        )}
        {rows.length > 1 && <RaceTrack rows={rows} />}
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
                          ? {
                              label: 'Remove from group',
                              onPress: () => confirmRemove(r),
                            }
                          : undefined,
                    })
            }
            delayLongPress={400}
            accessibilityLabel={`${i + 1}. ${r.name}${r.is_me ? ' (you)' : ''}, ${treats(r.xp)}${r.user_id === crown ? ', last week’s winner' : ''}`}
            style={[styles.row, r.is_me && styles.meRow]}>
            <AppText style={styles.rank}>{r.xp > 0 && MEDALS[i] ? MEDALS[i] : i + 1}</AppText>
            <AvatarWithBuddy id={r.user_id} name={r.name} size={36} photoPath={r.avatar_url} mascot={r.mascot} />
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
      <HowToEarn />
    </>
  );
}

const RACE_DOT = 30;

/**
 * The week's race as a track: everyone's buddy sits where their treats put
 * them, the leader at the finish. People close together stack up a lane.
 */
function RaceTrack({ rows }: { rows: GroupMemberRow[] }) {
  const [width, setWidth] = useState(0);
  const places = width ? raceTrack(rows, width, RACE_DOT) : [];
  const lanes = Math.max(1, ...places.map((p) => p.lane + 1));
  const lane = RACE_DOT + 2;
  const height = lanes * lane;
  const me = rows.find((r) => r.is_me);
  const mine = places.find((p) => p.user_id === me?.user_id);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={rows.map((r) => `${r.is_me ? 'You' : r.name} ${treats(r.xp)}`).join(', ')}
      style={[styles.track, { height }]}>
      <View style={[styles.trackLine, { top: height - RACE_DOT / 2 - 2 }]} />
      {mine && (
        <View
          style={[styles.trackLine, styles.trackMine, { top: height - RACE_DOT / 2 - 2, width: mine.x + RACE_DOT / 2 }]}
        />
      )}
      {places.map((p) => {
        const r = rows.find((x) => x.user_id === p.user_id)!;
        return (
          <View
            key={p.user_id}
            style={[styles.trackDot, { left: p.x, top: height - (p.lane + 1) * lane }, r.is_me && styles.trackDotMe]}>
            <BuddyChip mascot={r.mascot} size={RACE_DOT - 4} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * What gets you XP on this board: your own XP this week by source, the gap to
 * the next person up, and (tap to open) every way to earn it.
 */
function HowToEarn() {
  const { data: byKind } = useXpThisWeekByKind();
  const [open, setOpen] = useState(false);
  const mine = xpBreakdown(byKind ?? {});
  const total = mine.reduce((sum, k) => sum + k.xp, 0);
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
        router.push({
          pathname: '/group/podium/[id]',
          params: { id: groupId },
        });
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
  const member = (id: string) => rows.find((r) => r.user_id === id);
  return (
    <>
      <View style={styles.podiumHeader}>
        <SectionLabel>Last week’s podium</SectionLabel>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/group/podium/[id]',
              params: { id: groupId },
            })
          }
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
            <AvatarWithBuddy
              id={p.user_id}
              name={p.name}
              size={36}
              photoPath={member(p.user_id)?.avatar_url ?? null}
              mascot={member(p.user_id)?.mascot}
            />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  more: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squad: { gap: Spacing.sm + 4 },
  squadTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  buddies: { gap: Spacing.sm + 2, paddingRight: Spacing.xs },
  buddy: { width: 64, alignItems: 'center', gap: 2 },
  buddyFace: {
    width: BUDDY + 8,
    height: BUDDY + 8,
    borderRadius: (BUDDY + 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  buddyFaceDone: {
    backgroundColor: Colors.flameSoft,
    borderWidth: 2,
    borderColor: Colors.success,
  },
  buddyName: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  buddyStatus: { fontSize: 11 },
  inviteSlot: {
    width: BUDDY + 8,
    height: BUDDY + 8,
    borderRadius: (BUDDY + 8) / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteSlotHot: {
    borderColor: Colors.flame,
    backgroundColor: Colors.flameSoft,
  },
  segments: { flexDirection: 'row', gap: 4 },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.cardRaised,
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.xs,
  },
  track: { marginHorizontal: Spacing.xs, marginBottom: Spacing.sm },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardRaised,
  },
  trackMine: { right: undefined, backgroundColor: Colors.flame },
  trackDot: {
    position: 'absolute',
    width: RACE_DOT,
    height: RACE_DOT,
    borderRadius: RACE_DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  trackDotMe: { borderColor: Colors.flame },
  climb: {
    fontSize: 15,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  chatBar: {
    position: 'absolute',
    left: Spacing.sm + 4,
    right: Spacing.sm + 4,
    height: CHAT_BAR,
    borderRadius: CHAT_BAR / 2,
    paddingLeft: Spacing.md,
    paddingRight: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  unread: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontSize: 12, fontWeight: '800' },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  podiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.xs,
  },
  rank: {
    width: 28,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  note: { marginHorizontal: Spacing.xs },
});
