import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { levelFor } from '@/lib/levels';

/** Duolingo-style level badge with an XP progress bar. Tap it for "How XP works". */
export function LevelBar({ xp, pressable = true }: { xp: number; pressable?: boolean }) {
  const info = levelFor(xp);
  return (
    <Pressable
      disabled={!pressable}
      onPress={() => router.push('/xp')}
      accessibilityRole={pressable ? 'button' : undefined}
      accessibilityLabel={`Level ${info.level}, ${info.title}, ${info.into} of ${info.span} XP`}
      accessibilityHint={pressable ? 'Shows how XP works' : undefined}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={styles.badge}>
        <SymbolView name="bolt.fill" size={14} tintColor="#000" />
        <AppText variant="heading" color="#000" style={{ fontSize: 15 }}>
          {info.level}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.labels}>
          <AppText variant="caption" color={Colors.text}>
            {info.title}
          </AppText>
          <AppText variant="caption">
            {info.into} / {info.span} XP
          </AppText>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(info.progress * 100, 3)}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.xp,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    height: 32,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, backgroundColor: Colors.cardRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: Colors.xp },
});
