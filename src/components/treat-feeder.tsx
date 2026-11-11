import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascots';
import { AppText } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MASCOTS, type MascotKind } from '@/lib/mascots';
import { playSound } from '@/lib/sounds';

const WIDTH = 260;
const HEIGHT = 200;
const BUDDY = 110;
/** Where the treats start, across the top; they all land in the bowl's middle. */
const STARTS = [24, 92, 160, 220].map((x) => x - 18);
const BOWL_Y = 150;

/**
 * The welcome tour's treats lesson: your buddy behind an empty bowl with its
 * favorite treats floating above. Feed drops them into the bowl one by one,
 * the buddy cheers and the count ticks up. Tap again to replay.
 */
export function TreatFeeder({ kind }: { kind: MascotKind }) {
  const buddy = MASCOTS[kind];
  // Animated values live in state so they're made once and safe to read while rendering.
  const [flights] = useState(() => STARTS.map(() => new Animated.Value(0)));
  const [bounce] = useState(() => new Animated.Value(1));
  const [fill] = useState(() => new Animated.Value(0));
  const [fed, setFed] = useState(false);
  const [busy, setBusy] = useState(false);

  const feed = () => {
    if (busy) return;
    setBusy(true);
    setFed(false);
    flights.forEach((f) => f.setValue(0));
    fill.setValue(0);
    playSound('pop');
    Animated.stagger(
      140,
      flights.map((f) =>
        Animated.timing(f, { toValue: 1, duration: 650, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ),
    ).start(() => {
      setFed(true);
      setBusy(false);
      playSound('xp');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.sequence([
          Animated.spring(bounce, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 14 }),
          Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
        ]),
        Animated.timing(fill, { toValue: 1, duration: 400, useNativeDriver: false }),
      ]).start();
    });
    // A little tap as each treat lands.
    STARTS.forEach((_, i) => setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 650 + i * 140));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.stage} accessible accessibilityLabel={`${buddy.name} with a bowl, and ${buddy.treat.name} to feed them`}>
        <Animated.View style={[styles.buddy, { transform: [{ scale: bounce }] }]}>
          <Mascot kind={kind} mood={fed ? 'blazing' : 'ready'} size={BUDDY} />
        </Animated.View>

        <View style={styles.bowl}>
          <Animated.View
            style={[
              styles.bowlFill,
              { height: fill.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) },
            ]}
          />
        </View>
        <View style={styles.rim} />

        {STARTS.map((x, i) => {
          const f = flights[i]!;
          const dx = WIDTH / 2 - 18 - x;
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.treat,
                {
                  left: x,
                  opacity: f.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    { translateX: f.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                    { translateY: f.interpolate({ inputRange: [0, 1], outputRange: [0, BOWL_Y - 6] }) },
                    { scale: f.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
                  ],
                },
              ]}>
              <AppText style={styles.treatEmoji}>{buddy.treat.emoji}</AppText>
            </Animated.View>
          );
        })}

        {fed && (
          <View style={styles.bubble}>
            <AppText style={styles.bubbleText}>Yum! ¡Gracias!</AppText>
          </View>
        )}
      </View>

      <Pressable
        onPress={feed}
        accessibilityRole="button"
        accessibilityLabel={fed ? `Feed ${buddy.name} again` : `Feed ${buddy.name}`}
        style={({ pressed }) => [styles.button, fed && styles.buttonDone, pressed && { opacity: 0.8 }]}>
        <AppText style={[styles.buttonText, { color: fed ? Colors.flame : '#000' }]}>
          {fed ? `+43 treats for ${buddy.name} 🧡` : `${buddy.treat.emoji} Feed ${buddy.name}`}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.sm },
  stage: { width: WIDTH, height: HEIGHT },
  buddy: { position: 'absolute', left: (WIDTH - BUDDY) / 2, top: 52 },
  bowl: {
    position: 'absolute',
    left: WIDTH / 2 - 62,
    top: BOWL_Y + 8,
    width: 124,
    height: 34,
    borderBottomLeftRadius: 62,
    borderBottomRightRadius: 62,
    backgroundColor: '#E89A6B',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  bowlFill: { width: '100%', backgroundColor: '#B8562A' },
  rim: {
    position: 'absolute',
    left: WIDTH / 2 - 70,
    top: BOWL_Y + 2,
    width: 140,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F2B48D',
  },
  treat: {
    position: 'absolute',
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  treatEmoji: { fontSize: 22, lineHeight: 28 },
  bubble: {
    position: 'absolute',
    right: -6,
    top: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
  },
  bubbleText: { fontSize: 14, fontWeight: '800', color: Colors.text },
  button: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.flame,
  },
  buttonDone: { backgroundColor: Colors.flameSoft },
  buttonText: { fontSize: 16, fontWeight: '800' },
});
