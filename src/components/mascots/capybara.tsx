import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { MoodFace } from '@/components/mascots/face';
import { MascotMotion } from '@/components/mascots/motion';
import type { LotlMood } from '@/lib/lotl';
import { MOOD_LIFT } from '@/lib/mascots';

const FUR = '#A9794F';
const FUR_DARK = '#8E5E3B';
const MUZZLE = '#CFA27A';

/** Capi, the capybara: a tall boxy head, a big blunt snout, and tiny ears that perk or droop. */
export function Capybara({ mood, size = 120 }: { mood: LotlMood; size?: number }) {
  const lift = MOOD_LIFT[mood];

  return (
    <MascotMotion mood={mood} size={size}>
      {/* Body and feet (capybaras have no tail to speak of). */}
      <Ellipse cx={50} cy={99} rx={23} ry={16} fill={FUR} />
      <Ellipse cx={50} cy={103} rx={13} ry={9} fill={MUZZLE} />
      <Ellipse cx={36} cy={113} rx={7} ry={4} fill={FUR_DARK} />
      <Ellipse cx={64} cy={113} rx={7} ry={4} fill={FUR_DARK} />

      {/* Tiny ears set high on the head, tilting with the mood. */}
      <G transform={`rotate(${lift * 20} 27 36)`}>
        <Ellipse cx={25} cy={29} rx={5.5} ry={4.5} fill={FUR_DARK} />
        <Ellipse cx={25} cy={29.5} rx={2.6} ry={2.2} fill="#5E3B22" />
      </G>
      <G transform={`rotate(${-lift * 20} 73 36)`}>
        <Ellipse cx={75} cy={29} rx={5.5} ry={4.5} fill={FUR_DARK} />
        <Ellipse cx={75} cy={29.5} rx={2.6} ry={2.2} fill="#5E3B22" />
      </G>

      {/* Tall, boxy head with a big blunt snout and a dark nose pad. */}
      <Rect x={18} y={27} width={64} height={62} rx={22} fill={FUR} />
      <Rect x={22} y={70} width={56} height={18} rx={9} fill={MUZZLE} />
      <Ellipse cx={50} cy={72} rx={22} ry={13} fill={MUZZLE} />
      <Rect x={41} y={59} width={18} height={7} rx={3.5} fill="#5E3B22" />
      <Ellipse cx={45.5} cy={62.5} rx={1.6} ry={1.2} fill="#2A1A12" />
      <Ellipse cx={54.5} cy={62.5} rx={1.6} ry={1.2} fill="#2A1A12" />

      <MoodFace mood={mood} />

      {/* Capybaras famously nap with a mandarin on their head. */}
      {mood === 'sleepy' && (
        <G>
          <Circle cx={50} cy={21} r={7} fill="#FF9F1C" />
          <Circle cx={47.5} cy={18.5} r={1.8} fill="#FFD08A" />
          <Path d="M50 14 Q54 9 58 11 Q55 15 50 14 Z" fill="#4CAF50" />
        </G>
      )}
    </MascotMotion>
  );
}
