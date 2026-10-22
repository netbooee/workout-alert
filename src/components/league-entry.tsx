import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLeagueResult, useLeagueSettings, usePublicLeague } from '@/hooks/use-league';
import { resultLine, tierInfo } from '@/lib/leagues';

/** The Partners tab's way into leagues: where you stand this week, or an invitation to join. */
export function LeagueEntry() {
  const settings = useLeagueSettings();
  const joined = !!settings.data?.opted_in;
  const { data: rows } = usePublicLeague(joined);
  const { data: result } = useLeagueResult();
  if (settings.isPending) return null;

  const me = rows?.find((r) => r.is_me);
  const tier = tierInfo(me?.tier ?? settings.data?.tier ?? 1);
  const line = !joined
    ? 'Compete with people beyond your partners'
    : result
      ? resultLine(result.result, result.tier)
      : me
        ? `#${me.rank} of ${me.group_size} · ${me.xp} XP this week`
        : 'Earn XP to join this week’s group';

  return (
    <Pressable onPress={() => router.push('/league')} accessibilityRole="button">
      <Card style={[styles.card, !!result && styles.news]}>
        <View style={styles.badge}>
          <AppText style={{ fontSize: 26, lineHeight: 32 }}>{joined ? tier.emoji : '🏆'}</AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{joined ? `${tier.name} League` : 'Public leagues'}</AppText>
          <AppText variant="caption" numberOfLines={1}>
            {line}
          </AppText>
        </View>
        <SymbolView name="chevron.right" size={14} tintColor={Colors.textMuted} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  news: { borderColor: Colors.success, borderWidth: 1.5 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.flameSoft,
  },
});
