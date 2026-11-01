import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Segmented } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCreateGroup, useJoinGroup } from '@/hooks/use-groups';
import { friendlyError } from '@/lib/errors';
import { GROUP_EMOJI, GROUP_NAME_MAX } from '@/lib/groups';

/** Start a private group (a name and an emoji), or join one with its code. */
export default function NewGroupScreen() {
  const [mode, setMode] = useState<'start' | 'join'>('start');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(GROUP_EMOJI[0]);
  const [code, setCode] = useState('');
  const create = useCreateGroup();
  const join = useJoinGroup();

  const open = (id: string, created: boolean) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: '/group/[id]', params: { id, ...(created ? { created: '1' } : {}) } });
  };

  const start = () =>
    create.mutate(
      { name: name.trim(), emoji },
      { onSuccess: (g) => open(g.id, true), onError: (e) => Alert.alert('Couldn’t start the group', friendlyError(e)) },
    );

  const joinWithCode = () =>
    join.mutate(code.trim(), {
      onSuccess: (g) => open(g.id, false),
      onError: (e) => Alert.alert('Couldn’t join', friendlyError(e)),
    });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <AppText variant="heading" color={Colors.textSecondary}>
            Cancel
          </AppText>
        </Pressable>
        <AppText variant="heading">Groups</AppText>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Segmented
          options={[
            { key: 'start', label: 'Start a group' },
            { key: 'join', label: 'Join with a code' },
          ]}
          value={mode}
          onChange={setMode}
          size="large"
        />

        {mode === 'start' ? (
          <>
            <View style={styles.preview}>
              <AppText style={styles.previewEmoji}>{emoji}</AppText>
              <AppText variant="title" numberOfLines={1}>
                {name.trim() || 'Your group'}
              </AppText>
            </View>
            <AppText variant="label">Name</AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Office Gym Rats"
              placeholderTextColor={Colors.textMuted}
              maxLength={GROUP_NAME_MAX}
              style={styles.input}
              autoFocus
            />
            <AppText variant="label">Pick an emoji</AppText>
            <View style={styles.emojiGrid}>
              {GROUP_EMOJI.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setEmoji(e);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: e === emoji }}
                  style={[styles.emoji, e === emoji && styles.emojiOn]}>
                  <AppText style={styles.emojiText}>{e}</AppText>
                </Pressable>
              ))}
            </View>
            <AppText variant="caption">
              Up to 20 people. Everyone sees each other’s first name, buddy, photo, weekly XP and days toward
              their goal. Never workouts.
            </AppText>
            <Button
              title="Start the group"
              loading={create.isPending}
              disabled={name.trim().length < 2}
              onPress={start}
            />
          </>
        ) : (
          <>
            <AppText variant="body" color={Colors.textSecondary}>
              Ask someone in the group for its 6-character code, or open the invite link they sent you.
            </AppText>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABCD23"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, styles.code]}
              autoFocus
            />
            <Button title="Join" loading={join.isPending} disabled={code.length !== 6} onPress={joinWithCode} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  preview: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  previewEmoji: { fontSize: 56, lineHeight: 68 },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 17,
  },
  code: { textAlign: 'center', fontSize: 24, letterSpacing: 6, fontWeight: '700' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  emojiOn: { backgroundColor: Colors.flameSoft, borderWidth: 2, borderColor: Colors.flame },
  emojiText: { fontSize: 26, lineHeight: 32 },
});
