import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ProgressChart } from '@/components/progress-chart';
import { StreakHistory } from '@/components/streak-history';
import { Colors, Spacing } from '@/constants/theme';
import { useStreakHistory } from '@/hooks/use-home-data';

/** Home's "Last 12 weeks" row in full: the weekly chart (tap a week to open it) and streak history. */
export default function ProgressScreen() {
  const { data: history } = useStreakHistory();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Progress' }} />
      <ProgressChart />
      <StreakHistory weeks={history ?? []} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
});
