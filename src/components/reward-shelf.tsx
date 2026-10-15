import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyIncentives } from '@/hooks/use-incentives';
import { useNames } from '@/hooks/use-social';

/** Every incentive you've earned from your partners. */
export function RewardShelf() {
  const { received } = useMyIncentives();
  const nameOf = useNames();
  const earned = received.filter((i) => i.status === 'earned' || i.status === 'delivered');

  return (
    <Card>
      <AppText variant="label">Reward shelf{earned.length ? ` · ${earned.length}` : ''}</AppText>
      {earned.length === 0 ? (
        <AppText variant="caption">
          Rewards your partners offer you show up here once you earn them. 🎁
        </AppText>
      ) : (
        <View style={styles.shelf}>
          {earned.map((i) => (
            <Pressable
              key={i.id}
              onPress={() => router.push({ pathname: '/incentive/[id]', params: { id: i.id } })}
              style={styles.item}>
              <AppText variant="title" style={{ fontSize: 30 }}>
                {i.reward_emoji}
              </AppText>
              <AppText variant="caption" numberOfLines={2} style={styles.label}>
                {i.reward}
              </AppText>
              <AppText variant="caption" style={styles.from}>
                {i.status === 'earned' ? 'Owed by ' : 'From '}
                {nameOf(i.from_id).split(' ')[0]}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  item: {
    width: '31.5%',
    alignItems: 'center',
    gap: 2,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardRaised,
  },
  label: { textAlign: 'center', color: Colors.text, fontSize: 12 },
  from: { fontSize: 11 },
});
