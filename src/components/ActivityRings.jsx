const RINGS = [
  { key: 'move', color: '#FA3A4B', trackColor: '#3D0B0E', label: 'MOVE', unit: 'CAL', r: 54 },
  { key: 'exercise', color: '#A3E635', trackColor: '#1A2E0A', label: 'EXERCISE', unit: 'MIN', r: 40 },
  { key: 'stand', color: '#00C2FF', trackColor: '#00233B', label: 'STAND', unit: 'HRS', r: 26 },
]

const SIZE = 130
const CENTER = SIZE / 2
const STROKE = 10

function RingArc({ r, color, trackColor, pct }) {
  const circ = 2 * Math.PI * r
  const capped = Math.min(pct, 1)
  const offset = circ - capped * circ

  return (
    <g>
      <circle cx={CENTER} cy={CENTER} r={r} fill="none" stroke={trackColor} strokeWidth={STROKE} />
      {pct > 0 && (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className="ring-arc"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      )}
    </g>
  )
}

export default function ActivityRings({ rings }) {
  if (!rings) return null

  return (
    <div className="flex items-center gap-6">
      {/* SVG Rings */}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {RINGS.map(({ key, color, trackColor, r }) => {
          const ring = rings[key]
          const pct = ring ? ring.current / ring.goal : 0
          return (
            <RingArc key={key} r={r} color={color} trackColor={trackColor} pct={pct} />
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-3">
        {RINGS.map(({ key, color, label, unit }) => {
          const ring = rings[key]
          if (!ring) return null
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <div>
                <span className="text-apple-secondary text-xs font-semibold tracking-wider">{label} </span>
                <span className="text-white font-bold">{ring.current.toLocaleString()}</span>
                <span className="text-apple-secondary text-xs"> / {ring.goal} {unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
