import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useRequestPartner } from '@/hooks/use-social';

/** Handles streaks://invite/CODE links shared from the Add partner screen. */
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { mutate, data, error, isPending } = useRequestPartner();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !code) return;
    sent.current = true;
    mutate(code);
  }, [code, mutate]);

  return (
    <View style={styles.container}>
      {isPending || (!data && !error) ? (
        <ActivityIndicator color={Colors.flame} />
      ) : error ? (
        <>
          <AppText variant="title">That invite didn’t work</AppText>
          <AppText variant="body" color={Colors.textSecondary} style={styles.center}>
            {error instanceof Error ? error.message : String(error)}
          </AppText>
        </>
      ) : (
        <>
          <AppText variant="display">🤝</AppText>
          <AppText variant="title" style={styles.center}>
            {data?.status === 'accepted' ? 'You’re partners!' : 'Request sent'}
          </AppText>
          <AppText variant="body" color={Colors.textSecondary} style={styles.center}>
            {data?.status === 'accepted'
              ? 'You can now see each other’s workouts and streaks.'
              : 'They’ll appear in your partners once they accept.'}
          </AppText>
        </>
      )}
      <Button title="Go to partners" style={{ alignSelf: 'stretch' }} onPress={() => router.replace('/partners')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  center: { textAlign: 'center' },
});
