import { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { LotlMood } from '@/lib/lotl';

/** Ink color for eyes, brows, and mouths on every character. */
export const FACE = '#3B1E2B';

/**
 * The mood face shared by every character, drawn in the 100×120 mascot box with the
 * eyes around y = 57 and the mouth around y = 66–80. Each mood gets one signature
 * feature (blazing sunglasses, happy ^ ^ eyes with a laughing mouth, a ready
 * sweatband, a worried sweat drop, fired-up gritted teeth, a sleepy bubble) so it
 * reads at a glance, even at widget size.
 */
export function MoodFace({ mood }: { mood: LotlMood }) {
  const stroke = {
    stroke: FACE,
    strokeWidth: 3.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
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
          <Path
            d="M24 40.5 Q50 25 76 40.5"
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
            opacity={0.6}
          />
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
          <Path
            d="M83 30 C87 37 89 41 89 44 C89 48 86.5 50 83.5 50 C80 50 78 47.5 78.5 44 C79 41 80.5 37 83 30 Z"
            fill="#8FD3FF"
          />
          <Path
            d="M81.5 42 Q81.5 45 83.5 46.5"
            stroke="#fff"
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
            opacity={0.8}
          />
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
