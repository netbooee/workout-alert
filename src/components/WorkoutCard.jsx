import { useNavigate } from 'react-router-dom'
import WorkoutIcon from './WorkoutIcon'

function fmt(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

function fmtDist(distance, unit) {
  if (distance == null || distance === 0) return null
  if (unit === 'mi') return `${Number(distance).toFixed(2)} mi`
  if (unit === 'km') return `${Number(distance).toFixed(2)} km`
  const miles = Number(distance) / 1609.344
  return miles >= 0.1 ? `${miles.toFixed(2)} mi` : `${Math.round(distance)} m`
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function WorkoutCard({ workout, onSend }) {
  const navigate = useNavigate()
  const dist = fmtDist(workout.distance, workout.distanceUnit)

  const stats = [
    fmt(workout.duration),
    dist,
    workout.calories ? `${workout.calories} cal` : null,
  ].filter(Boolean)

  return (
    <div
      className="card bg-apple-card active:opacity-90 transition-opacity cursor-pointer"
      onClick={() => navigate(`/workout/${workout.id}`)}
    >
      <div className="p-4 flex items-center gap-4">
        <WorkoutIcon type={workout.type} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="font-semibold text-white text-base leading-tight">{workout.type}</h3>
            <span className="text-apple-secondary text-sm ml-2 flex-shrink-0">{fmtTime(workout.startDate)}</span>
          </div>
          <p className="text-apple-secondary text-sm">{stats.join(' · ')}</p>
          {workout.avgHeartRate && (
            <p className="text-apple-tertiary text-xs mt-0.5">
              ❤️ {workout.avgHeartRate} avg {workout.maxHeartRate ? `/ ${workout.maxHeartRate} max` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="bg-apple-blue text-white text-sm font-semibold px-3 py-1.5 rounded-full active:opacity-70 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onSend(workout)
            }}
          >
            Send
          </button>
          <svg className="text-apple-tertiary w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
