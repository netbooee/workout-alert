import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascots';
import { AppText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/lib/auth';
import type { LotlMood } from '@/lib/lotl';
import { mascotKind } from '@/lib/mascots';

/**
 * Nothing here yet: a buddy, one friendly line, and the one action that
 * fixes it, after Evernote's and MyFitnessPal's empty states. Shows your
 * own buddy unless `mascot` names someone else's.
 */
export function EmptyState({
  title,
  body,
  mascot,
  mood = 'ready',
  action,
}: {
  title: string;
  body?: string;
  mascot?: string | null;
  mood?: LotlMood;
  action?: ReactNode;
}) {
  const profile = useProfile();
  return (
    <View style={styles.container}>
      <Mascot kind={mascotKind(mascot ?? profile.mascot)} mood={mood} size={72} />
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="caption" style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm },
  center: { textAlign: 'center', maxWidth: 300 },
  action: { alignSelf: 'stretch', marginTop: Spacing.sm },
});
