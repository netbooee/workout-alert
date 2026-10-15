import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useMarkNudgesSeen, useNames, useUnseenNudges } from '@/hooks/use-social';

export function NudgeBanner() {
  const { data: nudges } = useUnseenNudges();
  const markSeen = useMarkNudgesSeen();
  const nameOf = useNames();
  if (!nudges?.length) return null;

  const names = [...new Set(nudges.map((n) => nameOf(n.from_id).split(' ')[0]))];
  const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <AppText variant="title" style={{ fontSize: 28 }}>
          👋
        </AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{who} nudged you</AppText>
          <AppText variant="caption">Your partners are counting on you. Time to move!</AppText>
        </View>
        <Pressable hitSlop={12} onPress={() => markSeen.mutate(nudges.map((n) => n.id))}>
          <AppText variant="caption" color={Colors.flame}>
            Got it
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
