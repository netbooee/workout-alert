import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { EMBER_LOOKS, type EmberMood } from '@/lib/ember';

const FACE = '#3A1400';
const VIEW_W = 100;
const VIEW_H = 120;

/**
 * Ember, the streak flame. Drawn in code so every mood is crisp at any size;
 * a Rive version can later replace this component without touching the mood
 * logic in lib/ember.ts.
 */
export function Ember({ mood, size = 120 }: { mood: EmberMood; size?: number }) {
  const look = EMBER_LOOKS[mood];
  // Gradient ids must be unique per instance (several Embers can be mounted).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
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
    const amp = mood === 'blazing' ? 0.07 : mood === 'sleepy' ? 0.025 : 0.04;
    return {
      transform: [
        { translateX: shake.value * 3 },
        { translateY: mood === 'blazing' ? -breathe.value * 4 : 0 },
        { scaleY: look.scale * (1 + breathe.value * amp) },
        { scaleX: look.scale * (1 - breathe.value * amp * 0.4) },
        { rotate: `${(breathe.value - 0.5) * (mood === 'sleepy' ? 2 : 5)}deg` },
      ],
    };
  });

  return (
    <View style={{ width: size, height: (size * VIEW_H) / VIEW_W }}>
      <Animated.View style={[{ flex: 1 }, animated]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <LinearGradient id={`outer${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={look.inner} />
              <Stop offset="1" stopColor={look.outer} />
            </LinearGradient>
            <LinearGradient id={`inner${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF3C4" />
              <Stop offset="1" stopColor={look.inner} />
            </LinearGradient>
          </Defs>
          <Path
            fill={`url(#outer${uid})`}
            d="M50 4 C58 22 84 36 85 66 C86 94 70 115 50 115 C30 115 14 94 15 68 C16 48 30 40 35 24 C40 32 43 36 46 40 C45 26 47 15 50 4 Z"
          />
          <Path
            fill={`url(#inner${uid})`}
            opacity={0.85}
            d="M50 42 C58 55 71 63 71 82 C71 99 62 109 50 109 C38 109 29 99 29 83 C29 69 42 60 50 42 Z"
          />
          <Face mood={mood} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Face({ mood }: { mood: EmberMood }) {
  const stroke = { stroke: FACE, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };
  const roundEyes = (
    <G>
      <Circle cx={41} cy={77} r={4} fill={FACE} />
      <Circle cx={59} cy={77} r={4} fill={FACE} />
      <Circle cx={42.3} cy={75.6} r={1.3} fill="#fff" />
      <Circle cx={60.3} cy={75.6} r={1.3} fill="#fff" />
    </G>
  );
  const cheeks = (
    <G opacity={0.45}>
      <Circle cx={33} cy={86} r={4} fill="#FF4D6D" />
      <Circle cx={67} cy={86} r={4} fill="#FF4D6D" />
    </G>
  );

  switch (mood) {
    case 'blazing':
      return (
        <G>
          {/* Sunglasses */}
          <Rect x={31} y={70} width={16} height={10} rx={4} fill={FACE} />
          <Rect x={53} y={70} width={16} height={10} rx={4} fill={FACE} />
          <Path d="M47 74 L53 74" {...stroke} />
          <Path d="M34 72 L38 72" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
          {/* Big grin */}
          <Path d="M38 88 Q50 104 62 88 Z" fill={FACE} />
          <Path d="M42 90 Q50 97 58 90" fill="#FF4D6D" opacity={0.8} />
          {cheeks}
        </G>
      );
    case 'happy':
      return (
        <G>
          <Path d="M36 78 Q41 71 46 78" {...stroke} />
          <Path d="M54 78 Q59 71 64 78" {...stroke} />
          <Path d="M40 88 Q50 98 60 88" {...stroke} />
          {cheeks}
        </G>
      );
    case 'ready':
      return (
        <G>
          {roundEyes}
          <Path d="M43 90 Q50 95 57 90" {...stroke} />
        </G>
      );
    case 'worried':
      return (
        <G>
          {roundEyes}
          <Path d="M34 70 L45 66" {...stroke} />
          <Path d="M55 66 L66 70" {...stroke} />
          <Path d="M41 93 Q45 89 50 93 Q55 97 59 93" {...stroke} />
          {/* Sweat drop */}
          <Path d="M74 60 C77 66 79 69 79 71 C79 74 77 75 75 75 C72 75 70 73 71 70 C71 68 72 65 74 60 Z" fill="#8FD3FF" />
        </G>
      );
    case 'fired_up':
      return (
        <G>
          <Circle cx={41} cy={79} r={3.2} fill={FACE} />
          <Circle cx={59} cy={79} r={3.2} fill={FACE} />
          <Path d="M33 69 L46 75" {...stroke} strokeWidth={3.5} />
          <Path d="M54 75 L67 69" {...stroke} strokeWidth={3.5} />
          <Path d="M41 95 Q50 87 59 95" {...stroke} />
          {/* Steam puffs */}
          <G opacity={0.55}>
            <Circle cx={22} cy={30} r={5} fill="#C9C9D1" />
            <Circle cx={16} cy={22} r={3.5} fill="#C9C9D1" />
            <Circle cx={78} cy={30} r={5} fill="#C9C9D1" />
            <Circle cx={84} cy={22} r={3.5} fill="#C9C9D1" />
          </G>
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d="M36 77 Q41 81 46 77" {...stroke} />
          <Path d="M54 77 Q59 81 64 77" {...stroke} />
          <Circle cx={50} cy={91} r={2.6} fill={FACE} />
          <SvgText x={70} y={46} fontSize={13} fontWeight="700" fill="#E6ECFF">
            z
          </SvgText>
          <SvgText x={79} y={34} fontSize={17} fontWeight="700" fill="#E6ECFF">
            Z
          </SvgText>
        </G>
      );
  }
}
