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
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { EMBER_LOOKS, type EmberMood } from '@/lib/ember';

const FACE = '#3B1E2B';
const VIEW_W = 100;
const VIEW_H = 120;

// Head geometry, shared by the gills and the face.
const HEAD = { cx: 50, cy: 58, rx: 34, ry: 28 };
// Where the three gills attach on the left side of the head (mirrored on the right),
// and the direction each one points before the mood tilts it (degrees, SVG coords).
const GILLS: { x: number; y: number; angle: number }[] = [
  { x: 22, y: 42, angle: 218 },
  { x: 18, y: 54, angle: 192 },
  { x: 20, y: 66, angle: 166 },
];
const GILL_LENGTH = 18;

/**
 * Ember, the streak axolotl. Drawn in code so every mood is crisp at any size;
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
    const amp = mood === 'blazing' ? 0.05 : mood === 'sleepy' ? 0.02 : 0.03;
    return {
      transform: [
        { translateX: shake.value * 3 },
        // Blazing bounces; everyone else gently bobs like they're floating.
        { translateY: -breathe.value * (mood === 'blazing' ? 6 : mood === 'sleepy' ? 1.5 : 3) },
        { scaleY: look.scale * (1 + breathe.value * amp) },
        { scaleX: look.scale * (1 - breathe.value * amp * 0.5) },
        { rotate: `${(breathe.value - 0.5) * (mood === 'sleepy' ? 2 : 4)}deg` },
      ],
    };
  });

  return (
    <View style={{ width: size, height: (size * VIEW_H) / VIEW_W }}>
      <Animated.View style={[{ flex: 1 }, animated]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <LinearGradient id={`body${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={look.belly} />
              <Stop offset="0.35" stopColor={look.body} />
              <Stop offset="1" stopColor={look.body} />
            </LinearGradient>
          </Defs>

          {/* Tail, body, and little arms sit behind the head. */}
          <Path
            d="M62 98 C78 96 90 102 94 112 C86 108 78 110 68 108 Z"
            fill={look.body}
            stroke={look.gills}
            strokeWidth={1.5}
          />
          <Ellipse cx={50} cy={98} rx={20} ry={15} fill={look.body} />
          <Ellipse cx={50} cy={101} rx={12} ry={9} fill={look.belly} />
          <Ellipse cx={33} cy={104} rx={5} ry={7} fill={look.body} transform="rotate(25 33 104)" />
          <Ellipse cx={67} cy={104} rx={5} ry={7} fill={look.body} transform="rotate(-25 67 104)" />

          <Gills color={look.gills} lift={look.gillLift} />

          <Ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} fill={`url(#body${uid})`} />
          {/* A lighter face patch keeps the expressions readable in every color. */}
          <Ellipse cx={50} cy={65} rx={24} ry={15} fill={look.belly} opacity={0.7} />

          <Face mood={mood} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Three feathery gills per side; `lift` tilts them up (happy/fired up) or down (worried/sleepy). */
function Gills({ color, lift }: { color: string; lift: number }) {
  const gills = GILLS.flatMap(({ x, y, angle }, i) => {
    const a = ((angle + lift) * Math.PI) / 180;
    // Mirror each left-side gill onto the right side of the head.
    const mirrored = { x: VIEW_W - x, y, a: Math.PI - a };
    return [
      { key: `l${i}`, x, y, a },
      { key: `r${i}`, ...mirrored },
    ];
  });

  return (
    <G>
      {gills.map(({ key, x, y, a }) => {
        const tx = x + Math.cos(a) * GILL_LENGTH;
        const ty = y + Math.sin(a) * GILL_LENGTH;
        // Frills: small bumps along each gill stalk.
        const frills = [0.45, 0.72].map((t) => ({
          x: x + Math.cos(a) * GILL_LENGTH * t,
          y: y + Math.sin(a) * GILL_LENGTH * t,
        }));
        return (
          <G key={key}>
            <Path d={`M${x} ${y} L${tx} ${ty}`} stroke={color} strokeWidth={5} strokeLinecap="round" />
            {frills.map((f, i) => (
              <Circle key={i} cx={f.x} cy={f.y} r={3.2} fill={color} />
            ))}
            <Circle cx={tx} cy={ty} r={3.6} fill={color} />
          </G>
        );
      })}
    </G>
  );
}

function Face({ mood }: { mood: EmberMood }) {
  const stroke = { stroke: FACE, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };
  // Axolotl eyes sit wide apart.
  const roundEyes = (
    <G>
      <Circle cx={34} cy={56} r={4.2} fill={FACE} />
      <Circle cx={66} cy={56} r={4.2} fill={FACE} />
      <Circle cx={35.4} cy={54.5} r={1.4} fill="#fff" />
      <Circle cx={67.4} cy={54.5} r={1.4} fill="#fff" />
    </G>
  );
  const cheeks = (
    <G opacity={0.5}>
      <Circle cx={27} cy={66} r={4.2} fill="#FF4D7E" />
      <Circle cx={73} cy={66} r={4.2} fill="#FF4D7E" />
    </G>
  );

  switch (mood) {
    case 'blazing':
      return (
        <G>
          {/* Sunglasses */}
          <Rect x={24} y={50} width={18} height={11} rx={4.5} fill={FACE} />
          <Rect x={58} y={50} width={18} height={11} rx={4.5} fill={FACE} />
          <Path d="M42 54 L58 54" {...stroke} />
          <Path d="M27 52.5 L32 52.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
          {/* Big open grin */}
          <Path d="M36 67 Q50 84 64 67 Z" fill={FACE} />
          <Path d="M41 70 Q50 78 59 70" fill="#FF4D7E" opacity={0.85} />
          {cheeks}
          {/* Sparkles */}
          <Path d="M10 22 L12 27 L17 29 L12 31 L10 36 L8 31 L3 29 L8 27 Z" fill="#FFD60A" />
          <Path d="M88 14 L89.5 18 L93.5 19.5 L89.5 21 L88 25 L86.5 21 L82.5 19.5 L86.5 18 Z" fill="#FFD60A" />
        </G>
      );
    case 'happy':
      return (
        <G>
          <Path d="M29 58 Q34 51 39 58" {...stroke} />
          <Path d="M61 58 Q66 51 71 58" {...stroke} />
          <Path d="M38 67 Q50 78 62 67" {...stroke} />
          {cheeks}
        </G>
      );
    case 'ready':
      return (
        <G>
          {roundEyes}
          <Path d="M42 68 Q50 74 58 68" {...stroke} />
          {cheeks}
        </G>
      );
    case 'worried':
      return (
        <G>
          {roundEyes}
          <Path d="M27 48 L39 45" {...stroke} />
          <Path d="M61 45 L73 48" {...stroke} />
          <Path d="M40 72 Q45 67 50 72 Q55 77 60 72" {...stroke} />
          {/* Sweat drop */}
          <Path d="M80 34 C83 40 85 43 85 45 C85 48 83 49 81 49 C78 49 76 47 77 44 C77 42 78 39 80 34 Z" fill="#8FD3FF" />
        </G>
      );
    case 'fired_up':
      return (
        <G>
          <Circle cx={35} cy={58} r={3.4} fill={FACE} />
          <Circle cx={65} cy={58} r={3.4} fill={FACE} />
          <Path d="M26 47 L41 53" {...stroke} strokeWidth={3.5} />
          <Path d="M59 53 L74 47" {...stroke} strokeWidth={3.5} />
          <Path d="M40 74 Q50 65 60 74" {...stroke} />
          {/* Steam puffs */}
          <G opacity={0.6}>
            <Circle cx={30} cy={16} r={5} fill="#C9C9D1" />
            <Circle cx={24} cy={8} r={3.5} fill="#C9C9D1" />
            <Circle cx={70} cy={16} r={5} fill="#C9C9D1" />
            <Circle cx={76} cy={8} r={3.5} fill="#C9C9D1" />
          </G>
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d="M29 57 Q34 61 39 57" {...stroke} />
          <Path d="M61 57 Q66 61 71 57" {...stroke} />
          <Circle cx={50} cy={70} r={2.8} fill={FACE} />
          <SvgText x={74} y={24} fontSize={13} fontWeight="700" fill="#E6ECFF">
            z
          </SvgText>
          <SvgText x={84} y={12} fontSize={17} fontWeight="700" fill="#E6ECFF">
            Z
          </SvgText>
        </G>
      );
  }
}
