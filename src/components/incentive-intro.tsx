import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useMyIncentives } from '@/hooks/use-incentives';
import type { PartnerState } from '@/hooks/use-social';

const KEY = 'intro:incentives:dismissed';

/**
 * Introduces incentives on the Partners tab until you've offered one or
 * dismissed it, so partners find the feature without hunting for it.
 */
export function IncentiveIntro({ partners }: { partners: PartnerState[] }) {
  const { given } = useMyIncentives();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setDismissed(v === '1'));
  }, []);

  if (dismissed || given.length > 0 || partners.length === 0) return null;

  // Suggest the partner who's closest to their goal without being done.
  const pick =
    [...partners]
      .filter((p) => p.this_week_days < p.this_week_goal)
      .sort((a, b) => b.this_week_days / b.this_week_goal - a.this_week_days / a.this_week_goal)[0] ??
    partners[0]!;
  const name = pick.display_name?.split(' ')[0] ?? 'your partner';

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(KEY, '1');
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <AppText variant="title" style={{ fontSize: 30 }}>
          🎁
        </AppText>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">New: reward extra effort</AppText>
          <AppText variant="caption">
            Offer a partner a treat for a stretch goal: “4 workouts this week → coffee on me.”
            Sigamos tracks it and they get +100 XP when they earn it.
          </AppText>
        </View>
      </View>
      <View style={{ gap: Spacing.sm }}>
        <Button
          title={`Offer ${name} an incentive`}
          style={{ height: 48 }}
          onPress={() => router.push({ pathname: '/incentive/new', params: { to: pick.partner_id } })}
        />
        <Pressable onPress={dismiss} hitSlop={8} style={styles.notNow}>
          <AppText variant="caption">Not now</AppText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  notNow: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: Spacing.md },
});
