import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { searchRewards, type RewardPreset } from '@/lib/incentives';

/** The whole reward library in a sheet: grouped, searchable, tap one to pick it. */
export function RewardPicker({
  visible,
  selectedId,
  onPick,
  onClose,
}: {
  visible: boolean;
  selectedId: string;
  onPick: (reward: RewardPreset) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const groups = searchRewards(query);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={() => setQuery('')}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AppText variant="heading">All rewards</AppText>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <AppText variant="heading" color={Colors.flame}>
              Done
            </AppText>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search rewards"
          placeholderTextColor={Colors.textMuted}
          clearButtonMode="while-editing"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search rewards"
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {groups.length === 0 && (
            <AppText variant="body" color={Colors.textSecondary} style={styles.empty}>
              No match. Pick 🎁 Custom and type your own.
            </AppText>
          )}
          {groups.map((group) => (
            <View key={group.title} style={{ gap: Spacing.sm }}>
              <AppText variant="label">{group.title}</AppText>
              <View style={styles.grid}>
                {group.rewards.map((p) => {
                  const selected = p.id === selectedId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onPick(p);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${p.label}: ${p.reward}`}
                      style={[styles.tile, selected && styles.tileSelected]}>
                      <AppText style={styles.emoji}>{p.emoji}</AppText>
                      <AppText
                        variant="caption"
                        color={selected ? Colors.text : Colors.textSecondary}
                        style={styles.label}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}>
                        {p.label}
                      </AppText>
                    </Pressable>
                  );
                })}
                {/* Keep the last row's tiles the same width as the others. */}
                {Array.from({ length: (4 - (group.rewards.length % 4)) % 4 }, (_, i) => (
                  <View key={`gap-${i}`} style={[styles.tile, styles.filler]} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  search: {
    marginHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  content: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  empty: { textAlign: 'center', marginTop: Spacing.lg },
  // Four labeled tiles per row.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.sm },
  tile: {
    width: '23.5%',
    minHeight: 84,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    gap: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  filler: { backgroundColor: 'transparent' },
  emoji: { fontSize: 28, lineHeight: 34 },
  label: { fontWeight: '600', textAlign: 'center' },
});
