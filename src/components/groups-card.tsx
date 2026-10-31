import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyGroups } from '@/hooks/use-groups';
import { MAX_GROUPS, squadLine } from '@/lib/groups';

/**
 * Your private groups: each with its squad streak and where this week
 * stands, opening the group. `compact` (Home) hides the card when you have
 * no groups; on Partners it invites you to start one.
 */
export function GroupsCard({ compact = false }: { compact?: boolean }) {
  const { data: groups, isSuccess } = useMyGroups();
  if (!isSuccess || (compact && !groups.length)) return null;

  return (
    <Card style={{ gap: Spacing.sm }}>
      <View style={styles.titleRow}>
        <AppText variant="label" style={{ flex: 1 }}>
          Your groups
        </AppText>
        {groups.length < MAX_GROUPS && (
          <Pressable
            onPress={() => router.push('/group/new')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Start or join a group">
            <AppText variant="caption" color={Colors.flame} style={{ fontWeight: '700' }}>
              + New or join
            </AppText>
          </Pressable>
        )}
      </View>

      {groups.length === 0 ? (
        <Pressable onPress={() => router.push('/group/new')} style={styles.empty} accessibilityRole="button">
          <AppText style={styles.emptyEmoji}>👯</AppText>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">Start a private group</AppText>
            <AppText variant="caption">
              Family, work, the gym crew: race for the top spot each week and keep a squad streak alive together.
            </AppText>
          </View>
          <SymbolView name="chevron.right" size={14} tintColor={Colors.textMuted} />
        </Pressable>
      ) : (
        groups.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${g.name}, ${g.squad_streak} week squad streak. ${squadLine(g)}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
            <View style={styles.emoji}>
              <AppText style={styles.emojiText}>{g.emoji}</AppText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="heading" numberOfLines={1}>
                {g.name}
              </AppText>
              <AppText variant="caption" numberOfLines={1} color={g.made >= g.need ? Colors.success : undefined}>
                {g.member_count >= 2 ? `${g.made} of ${g.need} goals · ` : ''}
                {squadLine(g)}
              </AppText>
            </View>
            <View style={styles.streak}>
              <AppText variant="heading" color={g.squad_streak > 0 ? Colors.flame : Colors.textMuted}>
                🔥 {g.squad_streak}
              </AppText>
            </View>
          </Pressable>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  emptyEmoji: { fontSize: 34, lineHeight: 42 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  emojiText: { fontSize: 24, lineHeight: 30 },
  streak: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: Colors.flameSoft },
});
