import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IncentiveCard } from '@/components/incentive-card';
import { AppText } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useCancelIncentive, useIncentive } from '@/hooks/use-incentives';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { isOpen } from '@/lib/incentives';

/** One incentive (also where incentive pushes land). */
export default function IncentiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: incentive, isPending } = useIncentive(id);
  const me = useAuth().session?.user.id;
  const cancel = useCancelIncentive();

  const confirmCancel = () =>
    Alert.alert('Cancel this challenge?', 'Your partner will no longer see it.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel challenge',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('Couldn’t cancel', friendlyError(e)),
          }),
      },
    ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 52 }} />
        <AppText variant="heading">Challenge</AppText>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AppText variant="heading" color={Colors.flame}>
            Done
          </AppText>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {isPending ? (
          <ActivityIndicator color={Colors.flame} />
        ) : !incentive ? (
          <AppText variant="body">This challenge is no longer available.</AppText>
        ) : (
          <>
            <IncentiveCard incentive={incentive} linked={false} />
            <AppText variant="caption">
              {incentive.shared
                ? 'Both of your workouts count and progress updates automatically. Finishing it is worth +100 XP each, and either of you can mark the reward done.'
                : 'Progress updates automatically from workouts. Earning it is worth +100 XP, and the reward itself is between the two of you.'}
            </AppText>
            {incentive.from_id === me && isOpen(incentive) && (
              <Pressable onPress={confirmCancel} style={styles.cancel} hitSlop={8}>
                <AppText variant="heading" color={Colors.danger}>
                  Cancel challenge
                </AppText>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  content: { padding: Spacing.md, gap: Spacing.md },
  cancel: { alignItems: 'center', paddingVertical: Spacing.md },
});
