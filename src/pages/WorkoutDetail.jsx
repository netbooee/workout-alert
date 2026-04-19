import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WorkoutIcon from '../components/WorkoutIcon'
import SendModal from '../components/SendModal'

function fmt(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function fmtDistance(distance, unit) {
  if (distance == null || distance === 0) return null
  if (unit === 'mi') return { value: Number(distance).toFixed(2), unit: 'mi', miles: Number(distance) }
  if (unit === 'km') return { value: Number(distance).toFixed(2), unit: 'km', miles: Number(distance) * 0.621371 }
  // legacy meters
  const miles = Number(distance) / 1609.344
  return { value: miles.toFixed(2), unit: 'mi', miles }
}

function fmtPace(distance, distanceUnit, seconds) {
  if (!distance || !seconds) return null
  let miles
  if (distanceUnit === 'mi') miles = Number(distance)
  else if (distanceUnit === 'km') miles = Number(distance) * 0.621371
  else miles = Number(distance) / 1609.344
  if (miles < 0.05) return null
  const minPerMile = seconds / 60 / miles
  const m = Math.floor(minPerMile)
  const s = Math.round((minPerMile - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}/mi`
}

function fmtDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function StatBlock({ label, value, unit, sub }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <p className="label-secondary">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-white text-2xl font-bold tracking-tight">{value ?? '—'}</span>
        {unit && <span className="text-apple-secondary text-sm">{unit}</span>}
      </div>
      {sub && <p className="text-apple-tertiary text-xs">{sub}</p>}
    </div>
  )
}

function HeartRateBar({ avg, max }) {
  if (!avg && !max) return null
  const pct = avg ? Math.min((avg / 220) * 100, 100) : 0

  const zone = avg < 100 ? { label: 'Rest', color: '#98989E' }
    : avg < 130 ? { label: 'Fat Burn', color: '#00C2FF' }
    : avg < 155 ? { label: 'Cardio', color: '#A3E635' }
    : avg < 175 ? { label: 'Anaerobic', color: '#FA3A4B' }
    : { label: 'Max', color: '#FF2D55' }

  return (
    <div className="card p-4">
      <p className="label-secondary mb-3">Heart Rate</p>
      <div className="flex items-end gap-4 mb-3">
        {avg && (
          <div>
            <p className="text-apple-secondary text-xs mb-0.5">Average</p>
            <div className="flex items-baseline gap-1">
              <span className="text-white text-3xl font-bold">{avg}</span>
              <span className="text-apple-secondary text-sm">bpm</span>
            </div>
          </div>
        )}
        {max && (
          <div>
            <p className="text-apple-secondary text-xs mb-0.5">Max</p>
            <div className="flex items-baseline gap-1">
              <span className="text-move text-2xl font-bold">{max}</span>
              <span className="text-apple-secondary text-sm">bpm</span>
            </div>
          </div>
        )}
        <div className="ml-auto text-right">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: zone.color, backgroundColor: zone.color + '22' }}>
            {zone.label}
          </span>
        </div>
      </div>
      <div className="h-2 bg-apple-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: zone.color }}
        />
      </div>
    </div>
  )
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [allData, setAllData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState(null)

  useEffect(() => {
    fetch('/api/workouts')
      .then((r) => r.json())
      .then((data) => {
        setAllData(data)
        const found = data.workouts?.find((w) => w.id === id)
        setWorkout(found || null)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleSend({ singleWorkout }) {
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workouts: allData?.workouts || [],
          healthStats: allData?.healthStats || {},
          include: {},
          workoutId: singleWorkout?.id || id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setSent(true)
      setTimeout(() => { setSent(false); setModal(false) }, 2000)
    } catch (e) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <p className="text-5xl">🔍</p>
        <p className="text-white font-semibold text-lg text-center">Workout not found</p>
        <button className="btn-ghost" onClick={() => navigate('/')}>← Back to Summary</button>
      </div>
    )
  }

  const dist = fmtDistance(workout.distance, workout.distanceUnit)
  const pace = fmtPace(workout.distance, workout.distanceUnit, workout.duration)
  const isCardio = dist !== null

  return (
    <div className="page-enter min-h-screen pb-36">
      {/* Nav */}
      <div className="px-4 pt-14 pb-2 flex items-center">
        <button
          className="flex items-center gap-1 text-apple-blue font-medium active:opacity-60 transition-opacity"
          onClick={() => navigate('/')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Summary
        </button>
      </div>

      {/* Hero */}
      <div className="px-5 pt-2 pb-6">
        <div className="flex items-center gap-4">
          <WorkoutIcon type={workout.type} size="lg" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{workout.type}</h1>
            <p className="text-apple-secondary text-sm mt-0.5">{fmtDateTime(workout.startDate)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-3">
        {/* Primary stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatBlock label="Duration" value={fmt(workout.duration)} />
          <StatBlock label="Calories" value={workout.calories} unit="kcal" />
          {dist && <StatBlock label="Distance" value={dist.value} unit={dist.unit} />}
          {pace && <StatBlock label="Pace" value={pace} />}
          {!dist && !pace && <StatBlock label="Active Time" value={fmt(workout.duration)} />}
        </div>

        {/* Heart rate */}
        <HeartRateBar avg={workout.avgHeartRate} max={workout.maxHeartRate} />

        {/* Workout details */}
        <div className="card p-4 space-y-3">
          <p className="label-secondary">Details</p>
          {[
            { label: 'Type', value: workout.type },
            { label: 'Started', value: workout.startDate ? new Date(workout.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—' },
            { label: 'Ended', value: workout.endDate ? new Date(workout.endDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—' },
            isCardio && { label: 'Distance', value: dist ? `${dist.value} ${dist.unit}` : '—' },
            isCardio && { label: 'Pace', value: pace || '—' },
          ].filter(Boolean).map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-apple-secondary text-sm">{label}</span>
              <span className="text-white text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Send button */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4"
        style={{ background: 'linear-gradient(to top, #000 60%, transparent)' }}>
        <button
          className="btn-primary w-full text-center text-base py-4 shadow-xl"
          onClick={() => { setSendError(null); setSent(false); setModal(true) }}
        >
          📲 Send This Workout
        </button>
      </div>

      {modal && (
        <SendModal
          data={allData || { workouts: [workout], healthStats: {} }}
          singleWorkout={workout}
          onClose={() => { setModal(false); setSendError(null); setSent(false) }}
          onTwilioSend={handleSend}
          twilioSending={sending}
          twilioSent={sent}
          twilioError={sendError}
        />
      )}
    </div>
  )
}
