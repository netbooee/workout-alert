import { useId } from 'react';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { MoodFace } from '@/components/mascots/face';
import { MascotMotion, VIEW_W } from '@/components/mascots/motion';
import { LOTL_LOOKS, type LotlMood } from '@/lib/lotl';

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

  return (
    <MascotMotion mood={mood} size={size} scale={look.scale}>
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

      <MoodFace mood={mood} />
    </MascotMotion>
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
