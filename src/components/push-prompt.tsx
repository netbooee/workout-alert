import { SymbolView } from 'expo-symbols';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useEnablePush, usePushStatus } from '@/hooks/use-push';

/** Asks to turn on notifications, or points to Settings if they were declined. */
export function PushPrompt() {
  const { data: status } = usePushStatus();
  const enable = useEnablePush();
  if (status !== 'undetermined' && status !== 'denied') return null;

  const onPress = () => {
    if (status === 'denied') {
      Linking.openSettings();
      return;
    }
    enable.mutate(undefined, {
      onError: (e) => Alert.alert('Could not turn on notifications', e instanceof Error ? e.message : String(e)),
    });
  };

  return (
    <Card>
      <View style={styles.row}>
        <SymbolView name="bell.badge.fill" size={26} tintColor={Colors.flame} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Know when partners move</AppText>
          <AppText variant="caption">
            Get a ping when a partner works out or nudges you.
          </AppText>
        </View>
      </View>
      <Button
        title={status === 'denied' ? 'Turn on in Settings' : 'Turn on notifications'}
        variant="secondary"
        loading={enable.isPending}
        onPress={onPress}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
