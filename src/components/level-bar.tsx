import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { levelFor } from '@/lib/levels';

/** Duolingo-style level badge with an XP progress bar. */
export function LevelBar({ xp }: { xp: number }) {
  const info = levelFor(xp);
  return (
    <View style={styles.row}>
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
    </View>
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
