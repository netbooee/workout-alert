import * as Haptics from 'expo-haptics';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascots';
import { AppText, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useProfile, useUpdateProfile } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { MASCOT_KINDS, MASCOTS, mascotKind, type MascotKind } from '@/lib/mascots';

/** Pick your streak buddy. Free to switch any time; partners see your pick. */
export function MascotPicker() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const mine = mascotKind(profile.mascot);
  const current = MASCOTS[mine];

  const pick = async (kind: MascotKind) => {
    if (kind === mine) return;
    Haptics.selectionAsync();
    try {
      await updateProfile({ mascot: kind });
    } catch (e) {
      Alert.alert('Could not change your buddy', friendlyError(e));
    }
  };

  return (
    <Card>
      <AppText variant="label">Your streak buddy</AppText>
      <View style={styles.row}>
        {MASCOT_KINDS.map((kind) => {
          const selected = kind === mine;
          return (
            <Pressable
              key={kind}
              onPress={() => pick(kind)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${MASCOTS[kind].name} the ${MASCOTS[kind].species.toLowerCase()}`}
              style={[styles.option, selected && styles.selected]}>
              <Mascot kind={kind} mood={selected ? 'happy' : 'ready'} size={52} />
              <AppText variant="caption" color={selected ? Colors.text : Colors.textSecondary} style={styles.name}>
                {MASCOTS[kind].name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption">
        {current.name} the {current.species.toLowerCase()} · {current.vibe}. Your partners see your buddy too.
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: 6,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  name: { fontWeight: '700' },
});
