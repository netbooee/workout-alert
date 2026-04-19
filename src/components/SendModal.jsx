import { useState, useMemo } from 'react'
import { buildSmsMessage, openNativeSms } from '../utils/sms'

const RECIPIENT = import.meta.env.VITE_RECIPIENT_PHONE || ''
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

function CheckRow({ checked, onChange, label, detail, disabled }) {
  return (
    <label className={`flex items-center justify-between py-3.5 border-b border-apple-separator last:border-0 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <div>
        <p className="text-white font-medium">{label}</p>
        {detail && <p className="text-apple-secondary text-sm">{detail}</p>}
      </div>
      <div
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          checked ? 'bg-apple-blue border-apple-blue' : 'border-apple-fill bg-transparent'
        }`}
        onClick={disabled ? undefined : onChange}
      >
        {checked && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </label>
  )
}

export default function SendModal({ data, singleWorkout, onClose, onTwilioSend, twilioSending, twilioSent, twilioError }) {
  const [include, setInclude] = useState({
    workouts: true,
    weight: !!data.healthStats?.weight,
    steps: !!data.healthStats?.steps,
    restingHR: !!data.healthStats?.restingHeartRate,
  })
  const [showPreview, setShowPreview] = useState(false)

  const toggle = (key) => setInclude((prev) => ({ ...prev, [key]: !prev[key] }))
  const { healthStats } = data

  const message = useMemo(() => buildSmsMessage({
    workouts: data.workouts || [],
    healthStats: data.healthStats || {},
    include,
    workoutId: singleWorkout?.id || null,
    appUrl: APP_URL,
  }), [include, data, singleWorkout])

  function handleNativeSms() {
    openNativeSms(RECIPIENT, message)
  }

  const nothingSelected = !singleWorkout && !Object.values(include).some(Boolean)

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-sheet w-full max-w-lg bg-apple-surface rounded-t-apple-xl pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-apple-fill rounded-full" />
        </div>

        <div className="px-5 pt-3 pb-2">
          <h2 className="text-xl font-bold text-white">
            {singleWorkout ? `Send ${singleWorkout.type}` : 'Send Update'}
          </h2>
          <p className="text-apple-secondary text-sm mt-0.5">
            {singleWorkout
              ? 'Opens Messages with this workout pre-filled.'
              : 'Choose what to include, then open Messages.'}
          </p>
        </div>

        {/* Checkboxes — only for summary sends */}
        {!singleWorkout && (
          <div className="px-5 mt-2">
            <div className="card px-4">
              <CheckRow
                checked={include.workouts}
                onChange={() => toggle('workouts')}
                label="Today's Workouts"
                detail={`${data.workouts?.length || 0} workout${data.workouts?.length !== 1 ? 's' : ''} recorded`}
                disabled={!data.workouts?.length}
              />
              <CheckRow
                checked={include.weight}
                onChange={() => toggle('weight')}
                label="Weight"
                detail={healthStats?.weight ? `${healthStats.weight.value} ${healthStats.weight.unit || 'lbs'}` : 'No data'}
                disabled={!healthStats?.weight}
              />
              <CheckRow
                checked={include.steps}
                onChange={() => toggle('steps')}
                label="Step Count"
                detail={healthStats?.steps ? `${healthStats.steps.count.toLocaleString()} steps` : 'No data'}
                disabled={!healthStats?.steps}
              />
              <CheckRow
                checked={include.restingHR}
                onChange={() => toggle('restingHR')}
                label="Resting Heart Rate"
                detail={healthStats?.restingHeartRate ? `${healthStats.restingHeartRate.value} bpm` : 'No data'}
                disabled={!healthStats?.restingHeartRate}
              />
            </div>
          </div>
        )}

        {/* Message preview toggle */}
        <div className="px-5 mt-3">
          <button
            className="text-apple-blue text-sm font-medium"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? 'Hide preview ↑' : 'Preview message ↓'}
          </button>
          {showPreview && (
            <div className="mt-2 bg-apple-card rounded-apple p-3">
              <pre className="text-apple-secondary text-xs whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
            </div>
          )}
        </div>

        <div className="px-5 mt-4 pb-6 flex flex-col gap-3">
          {/* Primary — native Messages */}
          <button
            className="btn-primary w-full text-center text-base py-4 shadow-xl disabled:opacity-50"
            disabled={nothingSelected}
            onClick={handleNativeSms}
          >
            💬 Open in Messages
          </button>

          {/* Secondary — Twilio (server-side, optional) */}
          {twilioSent ? (
            <div className="bg-exercise/20 border border-exercise/40 rounded-apple px-4 py-3 text-center">
              <p className="text-exercise font-semibold">✓ Sent via Twilio!</p>
            </div>
          ) : (
            <button
              className="w-full text-center text-apple-secondary text-sm py-2 rounded-full border border-apple-separator active:opacity-60 transition-opacity disabled:opacity-40"
              disabled={twilioSending || nothingSelected}
              onClick={() => onTwilioSend({ include, singleWorkout })}
            >
              {twilioSending ? 'Sending…' : '📡 Send via Twilio (background)'}
            </button>
          )}

          {twilioError && (
            <p className="text-red-400 text-sm text-center">{twilioError}</p>
          )}

          <button className="btn-ghost w-full text-center text-apple-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
