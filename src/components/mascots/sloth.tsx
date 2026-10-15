import { Ellipse, G, Path } from 'react-native-svg';

import { MoodFace } from '@/components/mascots/face';
import { MascotMotion } from '@/components/mascots/motion';
import type { LotlMood } from '@/lib/lotl';
import { MOOD_LIFT } from '@/lib/mascots';

const FUR = '#A88B6A';
const FUR_DARK = '#7C6248';
const MASK = '#F1E6D2';
const PATCH = '#C29A72';

/** Lento, the sloth: a shaggy head, a pale face mask, and long arms that go up when the week goes well. */
export function Sloth({ mood, size = 120 }: { mood: LotlMood; size?: number }) {
  const lift = MOOD_LIFT[mood];
  // Arms hang down when droopy and swing up and out when the week goes well (SVG degrees).
  const angle = 140 + lift * (lift > 0 ? 80 : 35);

  return (
    <MascotMotion mood={mood} size={size}>
      <Ellipse cx={50} cy={100} rx={21} ry={16} fill={FUR} />
      <Ellipse cx={50} cy={103} rx={12} ry={9} fill={MASK} opacity={0.8} />
      <Arm x={35} y={93} angle={angle} />
      <Arm x={65} y={93} angle={180 - angle} />

      {/* Shaggy head */}
      <Ellipse cx={42} cy={32} rx={6} ry={5} fill={FUR} />
      <Ellipse cx={50} cy={30} rx={6} ry={5} fill={FUR} />
      <Ellipse cx={58} cy={32} rx={6} ry={5} fill={FUR} />
      <Ellipse cx={50} cy={58} rx={33} ry={29} fill={FUR} />
      <Ellipse cx={50} cy={62} rx={26} ry={21} fill={MASK} />
      {/* The sloth's signature eye stripes */}
      <Ellipse cx={33} cy={59} rx={9} ry={5.5} fill={PATCH} transform="rotate(25 33 59)" />
      <Ellipse cx={67} cy={59} rx={9} ry={5.5} fill={PATCH} transform="rotate(-25 67 59)" />
      <Ellipse cx={50} cy={63.5} rx={4} ry={2.8} fill="#4A3426" />

      <MoodFace mood={mood} />
    </MascotMotion>
  );
}

/** A long sloth arm with three cream claws, pointing `angle` degrees from the shoulder. */
function Arm({ x, y, angle }: { x: number; y: number; angle: number }) {
  const a = (angle * Math.PI) / 180;
  const ex = x + Math.cos(a) * 22;
  const ey = y + Math.sin(a) * 22;
  const claws = [-0.45, 0, 0.45].map((d) => ({
    x: ex + Math.cos(a + d) * 5,
    y: ey + Math.sin(a + d) * 5,
  }));
  return (
    <G>
      <Path d={`M${x} ${y} L${ex} ${ey}`} stroke={FUR_DARK} strokeWidth={8} strokeLinecap="round" />
      {claws.map((c, i) => (
        <Path key={i} d={`M${ex} ${ey} L${c.x} ${c.y}`} stroke={MASK} strokeWidth={2} strokeLinecap="round" />
      ))}
    </G>
  );
}
