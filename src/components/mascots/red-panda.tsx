import { Ellipse, G, Path } from 'react-native-svg';

import { MoodFace } from '@/components/mascots/face';
import { MascotMotion } from '@/components/mascots/motion';
import type { LotlMood } from '@/lib/lotl';
import { MOOD_LIFT } from '@/lib/mascots';

const FUR = '#D4612E';
const FUR_DARK = '#7A3216';
const WHITE = '#FFF6EE';

/** Canela, the red panda: pointy white-lined ears, white cheeks, and a big ringed tail. */
export function RedPanda({ mood, size = 120 }: { mood: LotlMood; size?: number }) {
  const lift = MOOD_LIFT[mood];

  return (
    <MascotMotion mood={mood} size={size}>
      {/* Ringed tail: the same curve drawn twice, the second dashed in the darker color. */}
      <Path d="M62 104 C82 108 94 98 90 82" stroke={FUR} strokeWidth={12} strokeLinecap="round" fill="none" />
      <Path
        d="M62 104 C82 108 94 98 90 82"
        stroke={FUR_DARK}
        strokeWidth={12}
        strokeDasharray="4 7"
        strokeDashoffset={-6}
        fill="none"
      />

      {/* Red pandas have dark legs and belly. */}
      <Ellipse cx={50} cy={99} rx={20} ry={15} fill={FUR} />
      <Ellipse cx={50} cy={103} rx={12} ry={9} fill={FUR_DARK} />
      <Ellipse cx={37} cy={112} rx={6} ry={5} fill={FUR_DARK} />
      <Ellipse cx={63} cy={112} rx={6} ry={5} fill={FUR_DARK} />

      {/* Pointy ears, tilting with the mood. */}
      <G transform={`rotate(${lift * 18} 28 40)`}>
        <Path d="M17 45 L21 21 L39 34 Z" fill={FUR} stroke={FUR} strokeWidth={5} strokeLinejoin="round" />
        <Path d="M22 39 L24 27 L33 34 Z" fill={WHITE} stroke={WHITE} strokeWidth={2} strokeLinejoin="round" />
      </G>
      <G transform={`rotate(${-lift * 18} 72 40)`}>
        <Path d="M83 45 L79 21 L61 34 Z" fill={FUR} stroke={FUR} strokeWidth={5} strokeLinejoin="round" />
        <Path d="M78 39 L76 27 L67 34 Z" fill={WHITE} stroke={WHITE} strokeWidth={2} strokeLinejoin="round" />
      </G>

      <Ellipse cx={50} cy={58} rx={35} ry={28} fill={FUR} />
      {/* White face markings: brow spots, cheeks, and muzzle */}
      <Ellipse cx={34} cy={46} rx={5} ry={3.5} fill={WHITE} />
      <Ellipse cx={66} cy={46} rx={5} ry={3.5} fill={WHITE} />
      <Ellipse cx={25} cy={67} rx={9} ry={8} fill={WHITE} />
      <Ellipse cx={75} cy={67} rx={9} ry={8} fill={WHITE} />
      <Ellipse cx={50} cy={70} rx={15} ry={11} fill={WHITE} />
      <Path
        d="M46.5 61.5 L53.5 61.5 L50 65 Z"
        fill="#3B1E2B"
        stroke="#3B1E2B"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      <MoodFace mood={mood} />
    </MascotMotion>
  );
}
