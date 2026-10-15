import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import type { Workout } from '@/lib/database.types';
import { evidenceBadges } from '@/lib/evidence-badges';

const STRENGTH_COLOR = { strong: Colors.success, medium: Colors.freeze, weak: Colors.textSecondary };

export function EvidenceBadges({ workout }: { workout: Workout }) {
  return (
    <View style={styles.row}>
      {evidenceBadges(workout).map((b) => (
        <View key={b.label} style={styles.badge}>
          <SymbolView name={b.icon} size={12} tintColor={STRENGTH_COLOR[b.strength]} />
          <AppText variant="caption" color={STRENGTH_COLOR[b.strength]} style={{ fontSize: 12 }}>
            {b.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cardRaised,
  },
});
