import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View, type ColorValue } from 'react-native';

import { LeagueCard } from '@/components/league-card';
import { Mascot } from '@/components/mascots';
import { AppText, Button, Card, Segmented } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import {
  useLeagueSettings,
  usePublicLeague,
  useReportLeagueMember,
  useSetPublicLeague,
} from '@/hooks/use-league';
import { useLeague } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import type { PublicLeagueRow } from '@/lib/database.types';
import {
  demoteCount,
  MEDALS,
  NICKNAME_MAX,
  nicknameProblem,
  promoteCount,
  TIERS,
  tierInfo,
  trackRank,
  zoneFor,
  type RankMemo,
} from '@/lib/leagues';
import { mascotKind } from '@/lib/mascots';
import { dayKey } from '@/lib/week';

const fail = (title: string) => (e: unknown) => Alert.alert(title, e instanceof Error ? e.message : String(e));

/**
 * Leagues. Public: an opt-in weekly group of up to 20 people at your tier,
 * Duolingo-style, where the top move up and the bottom move down. Partners:
 * this week's XP among you and your partners.
 */
export default function LeagueScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [view, setView] = useState<'public' | 'partners'>(tab === 'partners' ? 'partners' : 'public');
  const partners = useLeague();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Leagues' }} />
      <Segmented
        options={[
          { key: 'public', label: 'Public' },
          { key: 'partners', label: 'Partners' },
        ]}
        value={view}
        onChange={setView}
        size="large"
      />
      {view === 'public' ? (
        <PublicLeague />
      ) : partners.data && partners.data.length > 1 ? (
        <LeagueCard rows={partners.data} />
      ) : (
        <AppText variant="caption">Add a partner to compete with them each week.</AppText>
      )}
    </ScrollView>
  );
}

function PublicLeague() {
  const settings = useLeagueSettings();
  const joined = !!settings.data?.opted_in;
  const table = usePublicLeague(joined);

  if (settings.isPending) return <ActivityIndicator color={Colors.flame} style={{ marginTop: Spacing.xl }} />;
  if (!joined) return <JoinCard nickname={settings.data?.nickname ?? ''} />;

  const rows = table.data ?? [];
  const tier = rows[0]?.tier ?? settings.data!.tier;

  return (
    <>
      <TierHeader tier={tier} groupSize={rows.length || 20} />
      {table.isPending ? (
        <ActivityIndicator color={Colors.flame} />
      ) : rows.length ? (
        <>
          <WeekStrip rows={rows} />
          <WillYouMakeIt rows={rows} />
          <Table rows={rows} />
        </>
      ) : (
        <Card>
          <AppText variant="heading">Earn XP to join this week’s group</AppText>
          <AppText variant="caption">
            Your first XP this week puts you in a group of up to 20 people in {tierInfo(tier).name}. Any
            workout, photo or step bonus counts.
          </AppText>
        </Card>
      )}
      <LeagueSettings nickname={settings.data?.nickname ?? ''} />
    </>
  );
}

function JoinCard({ nickname: saved }: { nickname: string }) {
  const profile = useProfile();
  const join = useSetPublicLeague();
  const [nickname, setNickname] = useState(saved);
  const problem = nicknameProblem(nickname);
  const firstName = profile.display_name?.split(' ')[0] ?? 'your first name';

  return (
    <Card style={styles.join}>
      <Mascot kind={mascotKind(profile.mascot)} mood="happy" size={110} />
      <AppText variant="title" style={{ textAlign: 'center' }}>
        Join public leagues
      </AppText>
      <View style={{ gap: Spacing.xs, alignSelf: 'stretch' }}>
        <Point text="Each week you’re matched with up to 20 people in time zones near yours." />
        <Point text="Earn the most XP and the top 5 move up a league. Spark → Ember → Flame → Blaze → Inferno." />
        <Point text="They see only your name, buddy and XP. Never your workouts, photos or partners." />
        <Point text="Hand-logged workouts without a photo count half here, to keep it fair." />
      </View>
      <View style={{ alignSelf: 'stretch', gap: 4 }}>
        <AppText variant="label">Nickname (optional)</AppText>
        <TextInput
          style={styles.input}
          placeholder={firstName}
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          maxLength={NICKNAME_MAX}
          value={nickname}
          onChangeText={setNickname}
        />
        <AppText variant="caption" color={problem ? Colors.danger : Colors.textMuted}>
          {problem ?? `Leave it blank to show “${firstName}”.`}
        </AppText>
      </View>
      <Button
        title="Join leagues"
        style={{ alignSelf: 'stretch' }}
        disabled={!!problem}
        loading={join.isPending}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          join.mutate({ on: true, nickname }, { onError: fail('Could not join') });
        }}
      />
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        You can leave any time from this screen.
      </AppText>
    </Card>
  );
}

function Point({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
      <AppText variant="body">•</AppText>
      <AppText variant="body" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

function TierHeader({ tier, groupSize }: { tier: number; groupSize: number }) {
  const info = tierInfo(tier);
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.tiers}>
        {TIERS.map((t) => (
          <View key={t.tier} style={[styles.tierBadge, t.tier === tier && styles.tierCurrent, t.tier > tier && { opacity: 0.35 }]}>
            <AppText style={{ fontSize: t.tier === tier ? 28 : 20, lineHeight: t.tier === tier ? 34 : 26 }}>{t.emoji}</AppText>
          </View>
        ))}
      </View>
      <AppText style={styles.tierTitle}>{info.name} League</AppText>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {tier < TIERS.length
          ? `Top ${promoteCount(groupSize)} move up to ${tierInfo(tier + 1).name}`
          : 'The top league. Hold on to it!'}
      </AppText>
    </View>
  );
}

const RANK_KEY = 'league:rank-memo';
const introKey = (week: string) => `league:intro-seen:${week}`;

/** Time left this week, and how many places you've moved since the day began. */
function WeekStrip({ rows }: { rows: PublicLeagueRow[] }) {
  const myRank = rows.find((r) => r.is_me)?.rank;
  const week = rows[0]!.week_start;
  const [moved, setMoved] = useState<number | null>(null);
  const left = 7 - new Date().getDay();

  useEffect(() => {
    if (myRank == null) return;
    let live = true;
    AsyncStorage.getItem(RANK_KEY)
      .then((raw) => {
        const next = trackRank(raw ? (JSON.parse(raw) as RankMemo) : null, week, dayKey(new Date()), myRank);
        if (live) setMoved(next.moved);
        return AsyncStorage.setItem(RANK_KEY, JSON.stringify(next.memo));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [week, myRank]);

  const color = moved && moved > 0 ? Colors.success : moved && moved < 0 ? Colors.danger : Colors.textSecondary;
  return (
    <Card style={styles.strip}>
      <View style={styles.stripCell}>
        <AppText variant="label" style={{ fontSize: 11 }}>
          Time left
        </AppText>
        <AppText variant="heading" color={Colors.flame}>
          ⏱ {left} day{left === 1 ? '' : 's'}
        </AppText>
      </View>
      <View style={styles.stripDivider} />
      <View style={styles.stripCell}>
        <AppText variant="label" style={{ fontSize: 11 }}>
          Today
        </AppText>
        <AppText variant="heading" color={color}>
          {moved == null || moved === 0
            ? '– 0 places'
            : `${moved > 0 ? '▲' : '▼'} ${Math.abs(moved)} place${Math.abs(moved) === 1 ? '' : 's'}`}
        </AppText>
      </View>
    </Card>
  );
}

/** Once a week, your buddy sets the goal for the group you just joined. */
function WillYouMakeIt({ rows }: { rows: PublicLeagueRow[] }) {
  const profile = useProfile();
  const week = rows[0]!.week_start;
  const tier = rows[0]!.tier;
  const [show, setShow] = useState(false);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(introKey(week))
      .then((seen) => {
        if (live && !seen) setShow(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [week]);

  if (!show) return null;
  const line =
    tier < TIERS.length
      ? `The top ${promoteCount(rows.length)} move up to ${tierInfo(tier + 1).name} ${tierInfo(tier + 1).emoji}. Will you make it?`
      : `You’re in ${tierInfo(tier).name}, the top league. Can you finish #1?`;

  return (
    <Card style={styles.intro}>
      <View style={styles.introRow}>
        <Mascot kind={mascotKind(profile.mascot)} mood="ready" size={64} />
        <View style={styles.introBubble}>
          <AppText variant="heading">{line}</AppText>
        </View>
      </View>
      <Button
        title="I can do it 💪"
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShow(false);
          AsyncStorage.setItem(introKey(week), '1').catch(() => {});
        }}
      />
    </Card>
  );
}

function Table({ rows }: { rows: PublicLeagueRow[] }) {
  const report = useReportLeagueMember();
  const n = rows.length;
  const tier = rows[0]!.tier;
  const ups = rows.filter((r) => zoneFor(r.rank, n, tier, r.xp) === 'up').length;
  const firstDown = rows.findIndex((r) => zoneFor(r.rank, n, tier, r.xp) === 'down');

  const ask = (r: PublicLeagueRow) =>
    Alert.alert(r.name, `${r.xp} XP this week`, [
      { text: 'Close', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          report.mutate(
            { key: r.member_key, reason: 'Reported from the league table' },
            {
              onSuccess: () => Alert.alert('Thanks', 'We’ll take a look.'),
              onError: fail('Could not report'),
            },
          ),
      },
    ]);

  return (
    <Card style={{ gap: 2, paddingHorizontal: Spacing.sm }}>
      {rows.map((r, i) => (
        <Fragment key={r.member_key}>
          {i === firstDown && <Divider label="Demotion zone" color={Colors.danger} arrow="▼" />}
          <Pressable
            disabled={r.is_me}
            onPress={() => ask(r)}
            accessibilityLabel={`${r.rank}. ${r.is_me ? 'You' : r.name}, ${r.xp} XP`}
            style={[styles.row, r.is_me && meTint(zoneFor(r.rank, n, tier, r.xp))]}>
            <AppText
              style={[styles.rank, { color: i < ups ? Colors.success : Colors.textSecondary }]}>
              {r.xp > 0 && MEDALS[r.rank - 1] ? MEDALS[r.rank - 1] : r.rank}
            </AppText>
            <Mascot kind={mascotKind(r.mascot)} mood={r.is_me ? 'blazing' : 'happy'} size={34} />
            <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {r.is_me ? `${r.name} (you)` : r.name}
            </AppText>
            <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
              {r.xp} XP
            </AppText>
          </Pressable>
          {ups > 0 && i === ups - 1 && i < n - 1 && <Divider label="Promotion zone" color={Colors.success} arrow="▲" />}
        </Fragment>
      ))}
      {n > 1 && (
        <AppText variant="caption" style={{ textAlign: 'center', marginTop: Spacing.xs }}>
          Tap someone to report spam or cheating.
        </AppText>
      )}
      {n > 1 && demoteCount(n) === 0 && tier > 1 && (
        <AppText variant="caption" style={{ textAlign: 'center', marginTop: Spacing.xs }}>
          Only players with no XP move down in a group this small.
        </AppText>
      )}
    </Card>
  );
}

/** Your row's colour says where you'd land if the week ended now. */
function meTint(zone: 'up' | 'stay' | 'down') {
  return zone === 'up' ? styles.meUp : zone === 'down' ? styles.meDown : styles.me;
}

function Divider({ label, color, arrow }: { label: string; color: ColorValue; arrow: string }) {
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
      <AppText variant="caption" color={color} style={{ fontWeight: '700', fontSize: 11 }}>
        {arrow} {label}
      </AppText>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
    </View>
  );
}

function LeagueSettings({ nickname: saved }: { nickname: string }) {
  const set = useSetPublicLeague();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(saved);
  const problem = nicknameProblem(nickname);

  return (
    <Card style={{ gap: Spacing.sm }}>
      <AppText variant="label">League settings</AppText>
      {editing ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Nickname (blank shows your first name)"
            placeholderTextColor={Colors.textMuted}
            autoCorrect={false}
            maxLength={NICKNAME_MAX}
            value={nickname}
            onChangeText={setNickname}
            autoFocus
          />
          {problem && (
            <AppText variant="caption" color={Colors.danger}>
              {problem}
            </AppText>
          )}
          <Button
            title="Save nickname"
            disabled={!!problem}
            loading={set.isPending}
            onPress={() =>
              set.mutate({ on: true, nickname }, { onSuccess: () => setEditing(false), onError: fail('Could not save') })
            }
          />
        </>
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.settingRow}>
          <AppText variant="body" style={{ flex: 1 }}>
            Shown as
          </AppText>
          <AppText variant="body" color={Colors.textSecondary}>
            {saved || 'Your first name'} ✏️
          </AppText>
        </Pressable>
      )}
      <Pressable
        onPress={() =>
          Alert.alert('Leave public leagues?', 'You’ll leave this week’s group. Your league is kept if you come back.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => set.mutate({ on: false, nickname: saved }, { onError: fail('Could not leave') }),
            },
          ])
        }
        style={styles.settingRow}>
        <AppText variant="body" color={Colors.danger}>
          Leave public leagues
        </AppText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  join: { alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  input: {
    height: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.cardRaised,
    color: Colors.text,
    fontSize: 17,
  },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tiers: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  tierBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  tierCurrent: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.flameSoft, borderWidth: 2, borderColor: Colors.flame },
  tierTitle: { fontFamily: Font.rounded, fontSize: 26, lineHeight: 32, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  me: { backgroundColor: Colors.flameSoft },
  meUp: { backgroundColor: 'rgba(52, 211, 153, 0.18)' },
  meDown: { backgroundColor: 'rgba(248, 113, 113, 0.16)' },
  strip: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  stripCell: { flex: 1, alignItems: 'center', gap: 2 },
  stripDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: Colors.border },
  intro: { gap: Spacing.md },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  introBubble: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.cardRaised,
  },
  rank: { width: 28, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, opacity: 0.5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
});
