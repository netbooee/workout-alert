import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useGroupPreview, useJoinGroup } from '@/hooks/use-groups';
import { friendlyError } from '@/lib/errors';

/** Opened by a group invite link (sigamos://group/join/CODE): shows the group, then joins it. */
export default function JoinGroupScreen() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? '').toUpperCase();
  const { data: group, isPending } = useGroupPreview(code);
  const join = useJoinGroup();

  const open = (id: string) => router.replace({ pathname: '/group/[id]', params: { id } });

  return (
    <View style={styles.container}>
      {isPending ? (
        <ActivityIndicator color={Colors.flame} />
      ) : !group ? (
        <>
          <AppText variant="title">That invite didn’t work</AppText>
          <AppText variant="body" color={Colors.textSecondary} style={styles.center}>
            The group may have been deleted, or the code changed. Ask for a new invite.
          </AppText>
          <Button title="Close" variant="secondary" style={styles.button} onPress={() => router.back()} />
        </>
      ) : (
        <>
          <AppText style={styles.emoji}>{group.emoji}</AppText>
          <AppText variant="title" style={styles.center}>
            {group.name}
          </AppText>
          <AppText variant="body" color={Colors.textSecondary} style={styles.center}>
            {group.is_member
              ? 'You’re already in this group.'
              : `${group.member_count} ${group.member_count === 1 ? 'person' : 'people'} race for the top spot each week and keep a squad streak alive together. They’ll see your first name, buddy, photo, weekly XP and days toward your goal. Never your workouts.`}
          </AppText>
          {group.is_member ? (
            <Button title="Open the group" style={styles.button} onPress={() => open(group.id)} />
          ) : (
            <>
              <Button
                title="Join the group"
                style={styles.button}
                loading={join.isPending}
                onPress={() =>
                  join.mutate(code, {
                    onSuccess: (g) => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      open(g.id);
                    },
                    onError: (e) => Alert.alert('Couldn’t join', friendlyError(e)),
                  })
                }
              />
              <Button title="Not now" variant="secondary" style={styles.button} onPress={() => router.back()} />
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  emoji: { fontSize: 72, lineHeight: 86 },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
