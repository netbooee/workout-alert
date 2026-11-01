import { StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';

/** How to say it: Spanish "sigamos", stress on the middle syllable. */
export const PRONUNCIATION = ['see', 'GAH', 'mohs'] as const;

/**
 * The app's name, taught: the phonetic spelling first (stressed syllable in
 * orange), with "Sigamos" under it, so nobody has to guess at a Spanish word.
 * Screens put the buddy above it.
 */
export function SigamosName() {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Sigamos, pronounced see-GAH-mohs">
      {/* Plain Text inside, so the pieces inherit this size instead of AppText's body style. */}
      <Text style={styles.phonetic}>
        {PRONUNCIATION.map((part, i) => (
          <Text key={part}>
            {i > 0 ? '-' : ''}
            <Text style={i === 1 ? styles.stress : undefined}>{part}</Text>
          </Text>
        ))}
      </Text>
      <AppText style={styles.name}>Sigamos</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 2 },
  phonetic: {
    fontFamily: Font.rounded,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  stress: { color: Colors.flame },
  name: {
    fontFamily: Font.rounded,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: -Spacing.xs / 2,
  },
});
