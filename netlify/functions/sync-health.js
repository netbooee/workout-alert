import { getStore } from '@netlify/blobs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// iOS Shortcuts outputs dates in many formats — normalise to ISO string
function parseDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? String(val) : d.toISOString()
}

// Accept a single workout object OR an array
function normaliseWorkouts(payload) {
  const raw = payload.workouts
    ? Array.isArray(payload.workouts)
      ? payload.workouts
      : [payload.workouts]
    : payload.workout
    ? [payload.workout]
    : []

  return raw.map((w, i) => ({
    id: `${Date.now()}-${i}`,
    type: w.type || w.workoutActivityType || w.activityType || 'Workout',
    startDate: parseDate(w.startDate || w.start_date),
    endDate:   parseDate(w.endDate   || w.end_date),
    // Shortcuts outputs duration in seconds; also accept minutes field
    duration:  Number(w.duration || w.durationInSeconds) || 0,
    // Shortcuts labels this "Total Energy Burned" in kcal
    calories:  Number(w.calories || w.totalEnergyBurned || w.activeEnergyBurned) || 0,
    // Shortcuts outputs distance in the user's locale unit (miles or km) as a number
    // We store it raw and surface the unit separately
    distance:  w.distance != null ? Number(w.distance) : null,
    distanceUnit: w.distanceUnit || w.distance_unit || null,
    avgHeartRate: Number(w.avgHeartRate || w.averageHeartRate) || null,
    maxHeartRate: Number(w.maxHeartRate) || null,
  }))
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = event.headers['x-api-key']
  if (apiKey !== process.env.SYNC_API_KEY) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  let payload
  try {
    payload = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const workouts = normaliseWorkouts(payload)

  // Weight — accept { value, unit } or a bare number
  const weightRaw = payload.weight
  const weight = weightRaw == null ? null
    : typeof weightRaw === 'object'
      ? { value: Number(weightRaw.value), unit: weightRaw.unit || 'lbs' }
      : { value: Number(weightRaw), unit: 'lbs' }

  // Steps — accept { count } or a bare number
  const stepsRaw = payload.steps
  const steps = stepsRaw == null ? null
    : typeof stepsRaw === 'object'
      ? { count: Number(stepsRaw.count || stepsRaw.value) }
      : { count: Number(stepsRaw) }

  // Resting HR — accept { value } or a bare number
  const hrRaw = payload.restingHeartRate
  const restingHeartRate = hrRaw == null ? null
    : typeof hrRaw === 'object'
      ? { value: Number(hrRaw.value) }
      : { value: Number(hrRaw) }

  const record = {
    workouts,
    healthStats: { weight, steps, restingHeartRate },
    rings: payload.rings || null,
    lastSynced: new Date().toISOString(),
  }

  const store = getStore('health-data')
  await store.setJSON('latest', record)

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, synced: workouts.length }),
  }
}
