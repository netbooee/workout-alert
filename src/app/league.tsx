import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View, type ColorValue } from 'react-native';

import { LeagueCard } from '@/components/league-card';
import { Mascot } from '@/components/mascots';
import { AppText, Button, Card, Segmented } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import {
  useLeagueResult,
  useLeagueSettings,
  useMarkLeagueResultSeen,
  usePublicLeague,
  useReportLeagueMember,
  useSetPublicLeague,
} from '@/hooks/use-league';
import { useLeague } from '@/hooks/use-social';
import { useProfile } from '@/lib/auth';
import type { LeagueResult, PublicLeagueRow } from '@/lib/database.types';
import {
  demoteCount,
  NICKNAME_MAX,
  nicknameProblem,
  promoteCount,
  resultLine,
  TIERS,
  tierInfo,
  zoneFor,
} from '@/lib/leagues';
import { mascotKind } from '@/lib/mascots';

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
  const result = useLeagueResult();

  if (settings.isPending) return <ActivityIndicator color={Colors.flame} style={{ marginTop: Spacing.xl }} />;
  if (!joined) return <JoinCard nickname={settings.data?.nickname ?? ''} />;

  const rows = table.data ?? [];
  const tier = rows[0]?.tier ?? settings.data!.tier;

  return (
    <>
      {result.data && <ResultCard result={result.data} />}
      <TierHeader tier={tier} />
      {table.isPending ? (
        <ActivityIndicator color={Colors.flame} />
      ) : rows.length ? (
        <Table rows={rows} />
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

function ResultCard({ result }: { result: LeagueResult }) {
  const profile = useProfile();
  const seen = useMarkLeagueResultSeen();
  return (
    <Card style={[styles.result, result.result === 'up' && { borderColor: Colors.success, borderWidth: 1.5 }]}>
      <Mascot
        kind={mascotKind(profile.mascot)}
        mood={result.result === 'up' ? 'blazing' : result.result === 'down' ? 'worried' : 'happy'}
        size={72}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="heading">{resultLine(result.result, result.tier)}</AppText>
        <AppText variant="caption">
          Last week you finished #{result.final_rank} of {result.group_size} with {result.final_xp} XP.
        </AppText>
        <Pressable onPress={() => seen.mutate()} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
            Got it
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

function TierHeader({ tier }: { tier: number }) {
  const info = tierInfo(tier);
  const left = 7 - new Date().getDay();
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.tiers}>
        {TIERS.map((t) => (
          <View key={t.tier} style={[styles.tierBadge, t.tier === tier && styles.tierCurrent, t.tier > tier && { opacity: 0.35 }]}>
            <AppText style={{ fontSize: t.tier === tier ? 28 : 20 }}>{t.emoji}</AppText>
          </View>
        ))}
      </View>
      <AppText style={styles.tierTitle}>{info.name} League</AppText>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        Top {promoteCount(20)} move up · {left} day{left === 1 ? '' : 's'} left
      </AppText>
    </View>
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
            style={[styles.row, r.is_me && styles.me]}>
            <AppText
              style={[styles.rank, { color: i < ups ? Colors.success : Colors.textSecondary }]}>
              {r.rank}
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
      {n > 1 && demoteCount(n) === 0 && tier > 1 && (
        <AppText variant="caption" style={{ textAlign: 'center', marginTop: Spacing.xs }}>
          Only players with no XP move down in a group this small.
        </AppText>
      )}
    </Card>
  );
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
  tierTitle: { fontFamily: Font.rounded, fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  me: { backgroundColor: Colors.flameSoft },
  rank: { width: 26, textAlign: 'center', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, opacity: 0.5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
});
