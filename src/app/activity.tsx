import { Stack } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { FeedRows } from '@/components/activity-card';
import { EmptyState } from '@/components/empty-state';
import { AppText, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { usePartnerFeed } from '@/hooks/use-social';

/** Every recent partner workout, one row each with Cheer and Verify (the Partners tab's See all). */
export default function ActivityScreen() {
  const feed = usePartnerFeed();
  const items = feed.data ?? [];
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={Colors.flame} />
      }>
      <Stack.Screen options={{ title: 'Activity' }} />
      {feed.isSuccess && items.length === 0 ? (
        <EmptyState
          title="No partner workouts yet"
          body="When your partners work out, it shows up here so you can cheer them on."
        />
      ) : (
        <Card style={styles.card}>
          <FeedRows items={items} />
        </Card>
      )}
      {items.length > 0 && (
        <AppText variant="caption" style={{ textAlign: 'center' }}>
          Tap 👏 to cheer (hold for more) and ✅ to verify you saw it.
        </AppText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl * 2 },
  card: { paddingVertical: Spacing.xs, gap: 0 },
});
