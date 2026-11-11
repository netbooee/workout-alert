import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { levelFor } from '@/lib/levels';

/** Your public league this week, or `joined: false` for an invitation. */
export type LeagueSummary = { joined: boolean; emoji: string; name: string; rank?: number; size?: number };

/** Your league this week, opening Leagues. `compact` drops "of N" for tight rows. */
export function LeagueChip({ joined, emoji, name, rank, size, compact = false }: LeagueSummary & { compact?: boolean }) {
  const label = !joined
    ? compact
      ? '🏆 League'
      : '🏆 Join a league'
    : `${emoji} ${name}${rank ? ` · #${rank}${!compact && size && size > 1 ? ` of ${size}` : ''}` : ''}`;
  return (
    <Pressable
      onPress={() => router.push('/league')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={joined ? `${name} League${rank ? `, place ${rank}` : ''}` : 'Join a public league'}
      style={({ pressed }) => [styles.chip, styles.leagueChip, pressed && { opacity: 0.7 }]}>
      <AppText variant="caption" color={Colors.text} numberOfLines={1} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Your XP and level, opening How XP works. `compact` shows just the level. */
export function XpChip({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const info = levelFor(xp);
  return (
    <Pressable
      onPress={() => router.push('/xp')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${xp} XP, level ${info.level}, ${info.title}`}
      accessibilityHint="Shows how XP works"
      style={({ pressed }) => [styles.chip, styles.xpChip, pressed && { opacity: 0.7 }]}>
      <AppText variant="caption" color={Colors.text} style={styles.chipText}>
        {compact ? `⚡ Level ${info.level}` : `⚡ ${xp.toLocaleString()} XP · Level ${info.level}`}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  xpChip: { backgroundColor: Colors.xpSoft },
  leagueChip: { backgroundColor: Colors.flameSoft },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
});
