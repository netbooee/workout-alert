import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { LotlMood } from '@/lib/lotl';

/** Every character is drawn in the same 100×120 box so faces and accessories line up. */
export const VIEW_W = 100;
export const VIEW_H = 120;

/**
 * Sizes the mascot box and gives it life: everyone gently bobs like they're floating,
 * blazing bounces, sleepy barely moves, and fired up shakes now and then.
 */
export function MascotMotion({
  mood,
  size,
  scale = 1,
  children,
}: {
  mood: LotlMood;
  size: number;
  scale?: number;
  children: ReactNode;
}) {
  const breathe = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    const period = mood === 'sleepy' ? 2600 : mood === 'blazing' ? 700 : mood === 'fired_up' ? 500 : 1400;
    breathe.value = 0;
    breathe.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
    shake.value = 0;
    if (mood === 'fired_up') {
      shake.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 60 }),
          withTiming(1, { duration: 60 }),
          withTiming(0, { duration: 60 }),
          withTiming(0, { duration: 900 }),
        ),
        -1,
      );
    }
  }, [mood, breathe, shake]);

  const animated = useAnimatedStyle(() => {
    const amp = mood === 'blazing' ? 0.05 : mood === 'sleepy' ? 0.02 : 0.03;
    return {
      transform: [
        { translateX: shake.value * 3 },
        { translateY: -breathe.value * (mood === 'blazing' ? 6 : mood === 'sleepy' ? 1.5 : 3) },
        { scaleY: scale * (1 + breathe.value * amp) },
        { scaleX: scale * (1 - breathe.value * amp * 0.5) },
        { rotate: `${(breathe.value - 0.5) * (mood === 'sleepy' ? 2 : 4)}deg` },
      ],
    };
  });

  return (
    <View style={{ width: size, height: (size * VIEW_H) / VIEW_W }}>
      <Animated.View style={[{ flex: 1 }, animated]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {children}
        </Svg>
      </Animated.View>
    </View>
  );
}
