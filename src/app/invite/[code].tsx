import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useRequestPartner } from '@/hooks/use-social';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { requestOutcome } from '@/lib/partner-request';

/** Handles invite links (sigamos://invite/CODE) for onboarded users; earlier ones wait for onboarding. */
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { mutate, data, error, isPending } = useRequestPartner();
  const sent = useRef(false);
  const me = useAuth().session?.user.id ?? '';
  const outcome = data ? requestOutcome(data, me) : null;

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
            {friendlyError(error)}
          </AppText>
        </>
      ) : (
        <>
          <AppText variant="display">🤝</AppText>
          <AppText variant="title" style={styles.center}>
            {outcome?.title}
          </AppText>
          <AppText variant="body" color={Colors.textSecondary} style={styles.center}>
            {outcome?.body}
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
