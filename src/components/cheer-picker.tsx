import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { ReactionKind } from '@/lib/database.types';
import { playSound } from '@/lib/sounds';

export interface PickerChoice<K extends string> {
  kind: K;
  emoji: string;
  label: string;
}

export const CHEER_EMOJI: PickerChoice<Exclude<ReactionKind, 'verified'>>[] = [
  { kind: 'clap', emoji: '👏', label: 'Clap' },
  { kind: 'fire', emoji: '🔥', label: 'Fire' },
  { kind: 'strong', emoji: '💪', label: 'Strong' },
];

const BURST = 9;
const BURST_MS = 1100;

/** One emoji floating up and away, a little later and further over than the last. */
const rise = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.6 }] },
    15: { opacity: 1, transform: [{ translateY: -40 }, { scale: 1.1 }] },
    100: { opacity: 0, transform: [{ translateY: -320 - (i % 3) * 60 }, { scale: 1.4 }] },
  })
    .duration(900)
    .delay(i * 45);

/**
 * Hold-to-cheer, after Ladder: a row of emoji pops up; pick one and it bursts
 * up the screen while the cheer is sent. Other quick sends (a nudge) use the
 * same sheet with their own `choices`.
 */
export function CheerPicker<K extends string = Exclude<ReactionKind, 'verified'>>({
  visible,
  title,
  subtitle,
  choices = CHEER_EMOJI as unknown as PickerChoice<K>[],
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  choices?: PickerChoice<K>[];
  onPick: (kind: K) => void;
  onClose: () => void;
}) {
  const [burst, setBurst] = useState<string | null>(null);

  const pick = (kind: K, emoji: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound('burst');
    onPick(kind);
    setBurst(emoji);
    setTimeout(() => {
      setBurst(null);
      onClose();
    }, BURST_MS);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={burst ? undefined : onClose} accessibilityLabel="Close">
        {burst ? (
          <View style={styles.burst} pointerEvents="none">
            {Array.from({ length: BURST }, (_, i) => (
              <Animated.Text
                key={i}
                entering={rise(i)}
                style={[styles.particle, { left: `${8 + ((i * 37) % 84)}%` }]}>
                {burst}
              </Animated.Text>
            ))}
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(150)} style={styles.sheet}>
            <AppText variant="heading" style={{ textAlign: 'center' }}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" style={{ textAlign: 'center', marginTop: -Spacing.sm }}>
                {subtitle}
              </AppText>
            ) : null}
            <View style={styles.row}>
              {choices.map((c, i) => (
                <Animated.View key={c.kind} entering={ZoomIn.delay(i * 60).springify().damping(10)}>
                  <Pressable
                    onPress={() => pick(c.kind, c.emoji)}
                    accessibilityRole="button"
                    accessibilityLabel={c.label}
                    style={({ pressed }) => [styles.emoji, pressed && { transform: [{ scale: 0.9 }] }]}>
                    <AppText style={styles.emojiText}>{c.emoji}</AppText>
                  </Pressable>
                  <AppText variant="caption" style={styles.label}>
                    {c.label}
                  </AppText>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)', padding: Spacing.lg },
  sheet: {
    gap: Spacing.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  emoji: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardRaised,
  },
  emojiText: { fontSize: 38, lineHeight: 46 },
  label: { textAlign: 'center', marginTop: 4, fontSize: 12 },
  burst: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  particle: { position: 'absolute', bottom: '18%', fontSize: 44, lineHeight: 52 },
});
