import { useState, useEffect } from 'react'
import ActivityRings from '../components/ActivityRings'
import WorkoutCard from '../components/WorkoutCard'
import HealthStatCard from '../components/HealthStatCard'
import SendModal from '../components/SendModal'

function fmtDate(d = new Date()) {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtSynced(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diffM = Math.round((now - d) / 60000)
  if (diffM < 1) return 'just now'
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.round(diffM / 60)
  if (diffH < 24) return `${diffH}h ago`
  return d.toLocaleDateString()
}

export default function Summary() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'summary' | workout object
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState(null)

  useEffect(() => {
    fetch('/api/workouts')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('Could not load workout data.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSend({ include, singleWorkout }) {
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workouts: data.workouts,
          healthStats: data.healthStats,
          include,
          workoutId: singleWorkout?.id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setModal(null)
      }, 2000)
    } catch (e) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  function openSummaryModal() {
    setSent(false)
    setSendError(null)
    setModal('summary')
  }

  function openWorkoutModal(workout) {
    setSent(false)
    setSendError(null)
    setModal(workout)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
          <p className="text-apple-secondary text-sm">Loading workouts…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-white font-semibold text-lg">{error}</p>
        </div>
      </div>
    )
  }

  const { workouts = [], healthStats = {}, rings, lastSynced, isDemo } = data

  return (
    <div className="page-enter min-h-screen pb-32">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Fitness</h1>
            <p className="text-apple-secondary text-sm mt-0.5">{fmtDate()}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {lastSynced && (
              <p className="text-apple-tertiary text-xs">Synced {fmtSynced(lastSynced)}</p>
            )}
            {isDemo && (
              <span className="text-xs bg-apple-elevated text-apple-secondary px-2 py-0.5 rounded-full">
                Demo data
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 space-y-3">
        {/* Activity Rings */}
        {rings && (
          <div className="card p-5">
            <p className="label-secondary mb-4">Activity</p>
            <ActivityRings rings={rings} />
          </div>
        )}

        {/* Workouts */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="label-secondary">Workouts</p>
            {workouts.length > 0 && (
              <span className="text-apple-secondary text-sm">{workouts.length} today</span>
            )}
          </div>

          {workouts.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-4xl mb-3">🏃</p>
              <p className="text-white font-semibold">No workouts today</p>
              <p className="text-apple-secondary text-sm mt-1">Sync from your iPhone to see workouts here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workouts.map((w) => (
                <WorkoutCard key={w.id} workout={w} onSend={openWorkoutModal} />
              ))}
            </div>
          )}
        </div>

        {/* Health Stats */}
        <div>
          <p className="label-secondary mb-2 px-1">Health Stats</p>
          <div className="grid grid-cols-2 gap-2">
            <HealthStatCard
              icon="⚖️"
              label="Weight"
              value={healthStats.weight?.value ? Math.round(healthStats.weight.value * 10) / 10 : null}
              unit={healthStats.weight?.unit || 'lbs'}
            />
            <HealthStatCard
              icon="👟"
              label="Steps"
              value={healthStats.steps?.count ? healthStats.steps.count.toLocaleString() : null}
              unit="steps"
            />
            <HealthStatCard
              icon="❤️"
              label="Resting HR"
              value={healthStats.restingHeartRate?.value || null}
              unit="bpm"
              sub="Resting heart rate"
            />
            <div className="card p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">📊</span>
                <span className="label-secondary">Workouts</span>
              </div>
              <p className="text-white text-3xl font-bold tracking-tight">{workouts.length}</p>
              <p className="text-apple-secondary text-xs">Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Send Button */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4"
        style={{ background: 'linear-gradient(to top, #000 60%, transparent)' }}>
        <button
          className="btn-primary w-full text-center text-base py-4 shadow-xl"
          onClick={openSummaryModal}
        >
          📲 Send Update to Wife
        </button>
      </div>

      {/* Send Modal */}
      {modal && (
        <SendModal
          data={data}
          singleWorkout={modal === 'summary' ? null : modal}
          onClose={() => { setModal(null); setSendError(null); setSent(false) }}
          onTwilioSend={handleSend}
          twilioSending={sending}
          twilioSent={sent}
          twilioError={sendError}
        />
      )}
    </div>
  )
}
