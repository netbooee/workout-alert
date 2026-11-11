import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyGroups } from '@/hooks/use-groups';
import { useLeagueResult, useLeagueSettings, usePublicLeague } from '@/hooks/use-league';
import { MAX_GROUPS, squadLine } from '@/lib/groups';
import { resultLine, tierInfo } from '@/lib/leagues';
import { treats } from '@/lib/treats';

/**
 * Where you compete, one row each: your public league (where you stand this
 * week, or an invitation), then each of your groups with its squad streak.
 * While you have room for another group, a last row starts or joins one.
 */
export function CompeteCard() {
  const settings = useLeagueSettings();
  const joined = !!settings.data?.opted_in;
  const { data: rows } = usePublicLeague(joined);
  const { data: result } = useLeagueResult();
  const groups = useMyGroups();

  const me = rows?.find((r) => r.is_me);
  const tier = tierInfo(me?.tier ?? settings.data?.tier ?? 1);
  const leagueLine = !joined
    ? 'Compete with people beyond your partners'
    : result
      ? resultLine(result.result, result.tier)
      : me
        ? `#${me.rank} of ${me.group_size} · ${treats(me.xp)} this week`
        : 'Earn treats to join this week’s group';
  const myGroups = groups.data ?? [];

  return (
    <Card style={styles.card}>
      {settings.isSuccess && (
        <Row
          href="/league"
          lead={<AppText style={styles.emoji}>{joined ? tier.emoji : '🏆'}</AppText>}
          leadStyle={[styles.leagueTile, !!result && styles.news]}
          title={joined ? `${tier.name} League` : 'Public leagues'}
          subtitle={leagueLine}
        />
      )}
      {myGroups.map((g) => (
        <Row
          key={g.id}
          href={{ pathname: '/group/[id]', params: { id: g.id } }}
          lead={<AppText style={styles.emoji}>{g.emoji}</AppText>}
          title={g.name}
          subtitle={`${g.member_count >= 2 ? `${g.made} of ${g.need} goals · ` : ''}${squadLine(g)}`}
          trail={
            <View style={styles.squad}>
              <AppText style={[styles.squadText, { color: g.squad_streak > 0 ? Colors.flame : Colors.textMuted }]}>
                🔥 {g.squad_streak}
              </AppText>
            </View>
          }
          divider
        />
      ))}
      {groups.isSuccess && myGroups.length < MAX_GROUPS && (
        <Row
          href="/group/new"
          lead={<SymbolView name="plus" size={16} weight="semibold" tintColor={Colors.flame} />}
          title={myGroups.length ? 'New or join a group' : 'Start a private group'}
          titleColor={Colors.flame}
          subtitle={myGroups.length ? undefined : 'Family, work, the gym crew: keep a squad streak together'}
          divider
        />
      )}
    </Card>
  );
}

function Row({
  href,
  lead,
  leadStyle,
  title,
  titleColor,
  subtitle,
  trail,
  divider = false,
}: {
  href: Href;
  lead: ReactNode;
  leadStyle?: StyleProp<ViewStyle>;
  title: string;
  titleColor?: ColorValue;
  subtitle?: string;
  trail?: ReactNode;
  divider?: boolean;
}) {
  return (
    <>
      {divider && <View style={styles.divider} />}
      <Pressable
        onPress={() => router.push(href)}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
        <View style={[styles.tile, leadStyle]}>{lead}</View>
        <View style={{ flex: 1, gap: 1 }}>
          <AppText style={[styles.title, titleColor ? { color: titleColor } : null]} numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" numberOfLines={1} style={{ fontSize: 12 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {trail}
        <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={Colors.textMuted} />
      </Pressable>
    </>
  );
}

const TILE = 36;

const styles = StyleSheet.create({
  card: { paddingVertical: Spacing.xs, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: TILE + Spacing.sm + 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4, minHeight: 54 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  leagueTile: { backgroundColor: Colors.flameSoft },
  news: { borderWidth: 1.5, borderColor: Colors.success },
  emoji: { fontSize: 19, lineHeight: 24 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: Colors.text },
  squad: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Colors.flameSoft },
  squadText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
