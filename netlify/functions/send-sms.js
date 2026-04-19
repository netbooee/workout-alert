import twilio from 'twilio'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDistance(meters) {
  if (!meters) return null
  const miles = meters / 1609.344
  return miles >= 0.5 ? `${miles.toFixed(2)} mi` : `${Math.round(meters)} m`
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
  if (t.includes('soccer') || t.includes('football')) return '⚽'
  if (t.includes('basket')) return '🏀'
  if (t.includes('tennis')) return '🎾'
  if (t.includes('elliptical')) return '🔄'
  if (t.includes('stair')) return '🪜'
  return '🏅'
}

function buildMessage({ workouts, healthStats, include, appUrl, workoutId }) {
  const lines = []

  if (workoutId) {
    // Single workout message
    const w = workouts.find((x) => x.id === workoutId) || workouts[0]
    if (!w) return 'Workout not found.'
    const dist = formatDistance(w.distance)
    lines.push(`${workoutEmoji(w.type)} ${w.type}`)
    lines.push(`Duration: ${formatDuration(w.duration)}`)
    if (dist) lines.push(`Distance: ${dist}`)
    lines.push(`Calories: ${w.calories} kcal`)
    if (w.avgHeartRate) lines.push(`Avg HR: ${w.avgHeartRate} bpm`)
    lines.push('')
    lines.push(`View workout: ${appUrl}/workout/${w.id}`)
  } else {
    // Summary message
    lines.push('💪 Workout Update')
    lines.push('')

    if (include.workouts && workouts.length) {
      lines.push(`Today's Workouts (${workouts.length}):`)
      workouts.forEach((w) => {
        const dist = formatDistance(w.distance)
        const parts = [formatDuration(w.duration)]
        if (dist) parts.push(dist)
        parts.push(`${w.calories} cal`)
        lines.push(`${workoutEmoji(w.type)} ${w.type} — ${parts.join(' · ')}`)
      })
      lines.push('')
    }

    const extras = []
    if (include.weight && healthStats?.weight) {
      extras.push(`⚖️ Weight: ${healthStats.weight.value} ${healthStats.weight.unit || 'lbs'}`)
    }
    if (include.steps && healthStats?.steps) {
      extras.push(`👟 Steps: ${healthStats.steps.count.toLocaleString()}`)
    }
    if (include.restingHR && healthStats?.restingHeartRate) {
      extras.push(`❤️ Resting HR: ${healthStats.restingHeartRate.value} bpm`)
    }
    if (extras.length) {
      lines.push(...extras)
      lines.push('')
    }

    lines.push(`View summary: ${appUrl}`)
  }

  return lines.join('\n')
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    RECIPIENT_PHONE,
    APP_URL,
  } = process.env

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !RECIPIENT_PHONE) {
    return {
      statusCode: 503,
      headers: CORS,
      body: JSON.stringify({ error: 'SMS not configured — set Twilio environment variables.' }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const appUrl = APP_URL || 'https://your-app.netlify.app'
  const message = buildMessage({ ...body, appUrl })

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  try {
    await client.messages.create({
      body: message,
      from: TWILIO_FROM_NUMBER,
      to: RECIPIENT_PHONE,
    })
  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: `Twilio error: ${err.message}` }),
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  }
}
