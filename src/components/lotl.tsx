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

import { LOTL_LOOKS, type LotlMood } from '@/lib/lotl';

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
 * Lotl, the streak axolotl. Drawn in code so every mood is crisp at any size;
 * a Rive version can later replace this component without touching the mood
 * logic in lib/lotl.ts.
 */
export function Lotl({ mood, size = 120 }: { mood: LotlMood; size?: number }) {
  const look = LOTL_LOOKS[mood];
  // Gradient ids must be unique per instance (several Lotls can be mounted).
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

function Face({ mood }: { mood: LotlMood }) {
  // Each mood gets one signature feature (sunglasses, ^ ^ eyes, sweatband, sweat
  // drop, gritted teeth, sleep bubble) so it reads at a glance, even at widget size.
  const stroke = { stroke: FACE, strokeWidth: 3.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const cheeks = (
    <G opacity={0.55}>
      <Circle cx={26} cy={67} r={4.5} fill="#FF4D7E" />
      <Circle cx={74} cy={67} r={4.5} fill="#FF4D7E" />
    </G>
  );

  switch (mood) {
    case 'blazing':
      return (
        <G>
          {/* Sunglasses */}
          <Rect x={23} y={49} width={20} height={12} rx={5} fill={FACE} />
          <Rect x={57} y={49} width={20} height={12} rx={5} fill={FACE} />
          <Path d="M43 53 L57 53" {...stroke} />
          <Path d="M27 52 L33 52" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.75} />
          <Path d="M61 52 L67 52" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.75} />
          {/* Big open grin */}
          <Path d="M35 66 Q50 86 65 66 Z" fill={FACE} />
          <Path d="M41 71 Q50 80 59 71 Q50 74 41 71 Z" fill="#FF4D7E" />
          {cheeks}
          {/* Sparkles */}
          <Path d="M10 20 L12.5 26.5 L19 29 L12.5 31.5 L10 38 L7.5 31.5 L1 29 L7.5 26.5 Z" fill="#FFD60A" />
          <Path d="M89 10 L91 15 L96 17 L91 19 L89 24 L87 19 L82 17 L87 15 Z" fill="#FFD60A" />
        </G>
      );
    case 'happy':
      return (
        <G>
          {/* ^ ^ eyes squeezed shut from smiling */}
          <Path d="M28 59 Q34 50 40 59" {...stroke} strokeWidth={4} />
          <Path d="M60 59 Q66 50 72 59" {...stroke} strokeWidth={4} />
          {/* Open, laughing mouth with a tongue */}
          <Path d="M39 66 Q50 82 61 66 Z" fill={FACE} strokeLinejoin="round" stroke={FACE} strokeWidth={2} />
          <Path d="M44 73 Q50 70 56 73 Q50 79 44 73 Z" fill="#FF6F9B" />
          {cheeks}
        </G>
      );
    case 'ready':
      return (
        <G>
          {/* Sweatband: dressed for the workout */}
          <Path d="M19 45 Q50 27 81 45" stroke="#FF6B1A" strokeWidth={7} strokeLinecap="round" fill="none" />
          <Path d="M24 40.5 Q50 25 76 40.5" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M82 44 L91 39" stroke="#FF6B1A" strokeWidth={4.5} strokeLinecap="round" />
          <Path d="M82 46 L90 51" stroke="#FF6B1A" strokeWidth={4.5} strokeLinecap="round" />
          {/* Big bright eyes */}
          <Circle cx={34} cy={57} r={5.2} fill={FACE} />
          <Circle cx={66} cy={57} r={5.2} fill={FACE} />
          <Circle cx={35.8} cy={55} r={1.9} fill="#fff" />
          <Circle cx={67.8} cy={55} r={1.9} fill="#fff" />
          {/* Confident half smile */}
          <Path d="M42 68 Q51 75 59 66" {...stroke} />
          {cheeks}
        </G>
      );
    case 'worried':
      return (
        <G>
          {/* Wide eyes, small pupils glancing up */}
          <Ellipse cx={34} cy={57} rx={6} ry={6.5} fill="#fff" stroke={FACE} strokeWidth={2} />
          <Ellipse cx={66} cy={57} rx={6} ry={6.5} fill="#fff" stroke={FACE} strokeWidth={2} />
          <Circle cx={35} cy={55.5} r={2.6} fill={FACE} />
          <Circle cx={67} cy={55.5} r={2.6} fill={FACE} />
          {/* Brows tilted up in the middle */}
          <Path d="M26 46 L39 42" {...stroke} />
          <Path d="M61 42 L74 46" {...stroke} />
          {/* Wobbly mouth */}
          <Path d="M39 73 Q42 69 45 73 Q48 77 51 73 Q54 69 57 73 Q59 76 61 73" {...stroke} strokeWidth={3} />
          {/* Sweat drop */}
          <Path d="M83 30 C87 37 89 41 89 44 C89 48 86.5 50 83.5 50 C80 50 78 47.5 78.5 44 C79 41 80.5 37 83 30 Z" fill="#8FD3FF" />
          <Path d="M81.5 42 Q81.5 45 83.5 46.5" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.8} />
        </G>
      );
    case 'fired_up':
      return (
        <G>
          {/* Thick angry brows over focused eyes */}
          <Path d="M24 46 L41 53" {...stroke} strokeWidth={4.5} />
          <Path d="M59 53 L76 46" {...stroke} strokeWidth={4.5} />
          <Circle cx={35} cy={59} r={3.8} fill={FACE} />
          <Circle cx={65} cy={59} r={3.8} fill={FACE} />
          {/* Gritted teeth: pumped, not sad */}
          <Rect x={37} y={66} width={26} height={11} rx={5} fill="#fff" stroke={FACE} strokeWidth={3} />
          <Path d="M37.5 71.5 L62.5 71.5" stroke={FACE} strokeWidth={1.8} />
          <Path d="M45.5 66.5 L45.5 76.5 M54.5 66.5 L54.5 76.5" stroke={FACE} strokeWidth={1.8} />
          {/* Steam puffs */}
          <G opacity={0.75}>
            <Circle cx={29} cy={15} r={5.5} fill="#C9C9D1" />
            <Circle cx={22} cy={6} r={4} fill="#C9C9D1" />
            <Circle cx={71} cy={15} r={5.5} fill="#C9C9D1" />
            <Circle cx={78} cy={6} r={4} fill="#C9C9D1" />
          </G>
        </G>
      );
    case 'sleepy':
      return (
        <G>
          {/* Closed, droopy eyes */}
          <Path d="M28 57 Q34 62 40 57" {...stroke} />
          <Path d="M60 57 Q66 62 72 57" {...stroke} />
          {/* Little snoring "o" and a sleep bubble */}
          <Ellipse cx={47} cy={71} rx={3} ry={3.6} fill={FACE} />
          <Circle cx={57} cy={68} r={6} fill="#E6ECFF" opacity={0.55} stroke="#fff" strokeWidth={1.2} />
          <Circle cx={55} cy={66} r={1.5} fill="#fff" opacity={0.9} />
          <SvgText x={72} y={26} fontSize={15} fontWeight="800" fill="#E6ECFF">
            z
          </SvgText>
          <SvgText x={83} y={13} fontSize={20} fontWeight="800" fill="#E6ECFF">
            Z
          </SvgText>
        </G>
      );
  }
}
