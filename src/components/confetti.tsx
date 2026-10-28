import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

const PIECES = 28;
/** Longer than the slowest piece, so nothing is cut off. */
const LIFETIME_MS = 3200;
const COLORS = [Colors.flame, Colors.xp, Colors.success, Colors.freeze, Colors.rest];

/** One strip falling and spinning, each a little later and further over than the last. */
const fall = (i: number, height: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 0 }, { translateX: 0 }, { rotate: '0deg' }] },
    10: { opacity: 1, transform: [{ translateY: height * 0.05 }, { translateX: 0 }, { rotate: '90deg' }] },
    100: {
      opacity: 0,
      transform: [
        { translateY: height * (0.65 + (i % 4) * 0.08) },
        { translateX: ((i % 5) - 2) * 18 },
        { rotate: `${360 + (i % 3) * 180}deg` },
      ],
    },
  })
    .duration(1800 + (i % 4) * 250)
    .delay((i % 7) * 70);

/**
 * A one-time burst of confetti over the whole screen, after Ladder's
 * "Workout complete". It never takes touches.
 */
export function Confetti() {
  const { height } = useWindowDimensions();
  // Gone once it has fallen, so no piece is left on screen when its animation ends.
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), LIFETIME_MS);
    return () => clearTimeout(id);
  }, []);
  if (done) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {Array.from({ length: PIECES }, (_, i) => (
        <Animated.View
          key={i}
          entering={fall(i, height)}
          style={[
            styles.piece,
            {
              left: `${(i * 37) % 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
              width: i % 3 === 0 ? 8 : 6,
              height: i % 3 === 0 ? 8 : 14,
              borderRadius: i % 3 === 0 ? 4 : 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // Starts just above the screen, so a piece is out of sight before and after it falls.
  piece: { position: 'absolute', top: -20 },
});
