export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

// workout.distanceUnit comes from the Shortcut (mi, km, or null)
// If unit is present use as-is; otherwise assume meters and convert
export function formatDistance(distance, unit) {
  if (distance == null || distance === 0) return null
  if (unit === 'mi') return `${Number(distance).toFixed(2)} mi`
  if (unit === 'km') return `${Number(distance).toFixed(2)} km`
  // legacy / no unit: assume meters
  const meters = Number(distance)
  const miles = meters / 1609.344
  return miles >= 0.1 ? `${miles.toFixed(2)} mi` : `${Math.round(meters)} m`
}

function workoutEmoji(type = '') {
  const t = type.toLowerCase()
  if (t.includes('run')) return '🏃'
  if (t.includes('walk')) return '🚶'
  if (t.includes('cycl') || t.includes('bike')) return '🚴'
  if (t.includes('swim')) return '🏊'
  if (t.includes('strength') || t.includes('weight')) return '🏋️'
  if (t.includes('yoga')) return '🧘'
  if (t.includes('hiit') || t.includes('interval')) return '💪'
  if (t.includes('hik')) return '🥾'
  if (t.includes('row')) return '🚣'
  return '🏅'
}

export function buildSmsMessage({ workouts = [], healthStats = {}, include = {}, workoutId = null, appUrl = '' }) {
  const lines = []

  if (workoutId) {
    const w = workouts.find((x) => x.id === workoutId) || workouts[0]
    if (!w) return ''
    const dist = formatDistance(w.distance)
    lines.push(`${workoutEmoji(w.type)} ${w.type}`)
    lines.push(`Duration: ${formatDuration(w.duration)}`)
    if (dist) lines.push(`Distance: ${dist}`)
    lines.push(`Calories: ${w.calories} kcal`)
    if (w.avgHeartRate) lines.push(`Avg HR: ${w.avgHeartRate} bpm`)
    if (appUrl) { lines.push(''); lines.push(`View: ${appUrl}/workout/${w.id}`) }
  } else {
    lines.push('💪 Workout Update')

    if (include.workouts && workouts.length) {
      lines.push('')
      lines.push(`Workouts (${workouts.length}):`)
      workouts.forEach((w) => {
        const dist = formatDistance(w.distance)
        const parts = [formatDuration(w.duration)]
        if (dist) parts.push(dist)
        if (w.calories) parts.push(`${w.calories} cal`)
        lines.push(`${workoutEmoji(w.type)} ${w.type} — ${parts.join(' · ')}`)
      })
    }

    const extras = []
    if (include.weight && healthStats?.weight)
      extras.push(`⚖️ ${healthStats.weight.value} ${healthStats.weight.unit || 'lbs'}`)
    if (include.steps && healthStats?.steps)
      extras.push(`👟 ${healthStats.steps.count.toLocaleString()} steps`)
    if (include.restingHR && healthStats?.restingHeartRate)
      extras.push(`❤️ ${healthStats.restingHeartRate.value} bpm resting`)

    if (extras.length) { lines.push(''); lines.push(...extras) }
    if (appUrl) { lines.push(''); lines.push(appUrl) }
  }

  return lines.join('\n')
}

export function openNativeSms(phone, message) {
  // iOS: sms:NUMBER&body=MSG  |  Android: sms:NUMBER?body=MSG
  const isAndroid = /android/i.test(navigator.userAgent)
  const sep = isAndroid ? '?' : '&'
  const encoded = encodeURIComponent(message)
  window.location.href = `sms:${phone}${sep}body=${encoded}`
}
