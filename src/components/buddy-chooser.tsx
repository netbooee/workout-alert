import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Mascot } from '@/components/mascots';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MASCOT_KINDS, MASCOTS, type MascotKind } from '@/lib/mascots';

const SPARKLES = ['✨', '💖', '⭐', '🎉', '✨', '💫'];

/**
 * Pick your streak buddy, with some fun: the chosen character springs onto a
 * stage, does a little wiggle, and sparkles burst around it. The others nap in
 * their tiles until you tap one.
 */
export function BuddyChooser({ value, onChange }: { value: MascotKind; onChange: (kind: MascotKind) => void }) {
  // Each pick restarts the burst.
  const [burst, setBurst] = useState(0);
  const wiggle = useSharedValue(0);

  useEffect(() => {
    wiggle.set(withSequence(
      withTiming(-1, { duration: 90 }),
      withTiming(1, { duration: 120 }),
      withTiming(-0.6, { duration: 110 }),
      withTiming(0, { duration: 120 }),
    ));
  }, [value, wiggle]);

  const stageStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value * 8}deg` }] }));

  const pick = (kind: MascotKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBurst((b) => b + 1);
    onChange(kind);
  };

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        {burst > 0 && SPARKLES.map((s, i) => <Sparkle key={`${burst}-${i}`} emoji={s} index={i} />)}
        <Animated.View style={stageStyle}>
          <Animated.View key={value} entering={ZoomIn.springify().damping(9)} exiting={FadeOut.duration(100)}>
            <Mascot kind={value} mood="blazing" size={170} />
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.View key={`${value}-label`} entering={FadeIn.duration(250)} style={styles.label}>
        <AppText variant="title">
          {MASCOTS[value].name}
          <AppText variant="caption"> the {MASCOTS[value].species.toLowerCase()}</AppText>
        </AppText>
        <AppText variant="caption">{MASCOTS[value].vibe}</AppText>
      </Animated.View>

      <View style={styles.row}>
        {MASCOT_KINDS.map((kind) => (
          <Tile key={kind} kind={kind} selected={kind === value} onPress={() => pick(kind)} />
        ))}
      </View>
    </View>
  );
}

function Tile({ kind, selected, onPress }: { kind: MascotKind; selected: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={() => {
        scale.set(withSequence(withTiming(0.88, { duration: 80 }), withSpring(1, { damping: 6 })));
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${MASCOTS[kind].name} the ${MASCOTS[kind].species.toLowerCase()}`}
      style={{ flex: 1 }}>
      <Animated.View style={[styles.tile, selected && styles.tileSelected, style]}>
        <Mascot kind={kind} mood={selected ? 'happy' : 'sleepy'} size={56} />
        <AppText
          variant="caption"
          color={selected ? Colors.text : Colors.textSecondary}
          style={{ fontWeight: '700' }}>
          {MASCOTS[kind].name}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

/** One sparkle flying out from the center of the stage and fading. */
function Sparkle({ emoji, index }: { emoji: string; index: number }) {
  const t = useSharedValue(0);
  const angle = (index / SPARKLES.length) * Math.PI * 2 - Math.PI / 2;
  useEffect(() => {
    t.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * 110 * t.value },
      { translateY: Math.sin(angle) * 90 * t.value },
      { scale: 0.6 + t.value * 0.8 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sparkle, style]}>
      <AppText style={{ fontSize: 22 }}>{emoji}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md, alignItems: 'stretch' },
  stage: { height: 210, alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute' },
  label: { alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: 6,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Colors.card,
  },
  tileSelected: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
});
