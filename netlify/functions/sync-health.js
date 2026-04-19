import { getStore } from '@netlify/blobs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function parseDate(val) {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? String(val) : d.toISOString()
}

// Strip "HKWorkoutActivityType" prefix that Health Auto Export includes
function cleanWorkoutType(raw = '') {
  return raw
    .replace(/^HKWorkoutActivityType/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → words
    .trim() || 'Workout'
}

// ── Health Auto Export format ─────────────────────────────────────────────────
// Sends { data: { workouts: [...], metrics: [{ name, data:[{qty,date}] }] } }
function fromHealthAutoExport(payload) {
  const d = payload.data || {}

  const workouts = (d.workouts || []).map((w, i) => ({
    id: `${Date.now()}-${i}`,
    type: cleanWorkoutType(w.workoutActivityType || w.name),
    startDate: parseDate(w.start || w.startDate),
    endDate:   parseDate(w.end   || w.endDate),
    duration:  Number(w.duration) || 0,
    calories:  Number(w.activeEnergy?.qty ?? w.totalEnergyBurned) || 0,
    distance:  w.totalDistance?.qty != null ? Number(w.totalDistance.qty) : null,
    distanceUnit: w.totalDistance?.units?.toLowerCase().startsWith('km') ? 'km' : 'mi',
    avgHeartRate: Number(w.heartRateData?.avg ?? w.avgHeartRate) || null,
    maxHeartRate: Number(w.heartRateData?.max ?? w.maxHeartRate) || null,
  }))

  // Pull scalar metrics out of the metrics array by name
  function metric(name) {
    const m = (d.metrics || []).find(
      (x) => x.name?.toLowerCase().replace(/[^a-z]/g, '') === name.toLowerCase().replace(/[^a-z]/g, '')
    )
    return m?.data?.[0]?.qty ?? null
  }

  const weightQty  = metric('bodymass') ?? metric('weight')
  const stepsQty   = metric('stepcount') ?? metric('steps')
  const restingHRQty = metric('restingheartrate')

  return {
    workouts,
    weight:          weightQty  != null ? { value: Number(weightQty),  unit: 'lbs' } : null,
    steps:           stepsQty   != null ? { count: Number(stepsQty) }               : null,
    restingHeartRate: restingHRQty != null ? { value: Number(restingHRQty) }         : null,
  }
}

// ── Manual / Shortcuts format ─────────────────────────────────────────────────
function fromManual(payload) {
  const raw = payload.workouts
    ? Array.isArray(payload.workouts) ? payload.workouts : [payload.workouts]
    : payload.workout ? [payload.workout] : []

  const workouts = raw.map((w, i) => ({
    id: `${Date.now()}-${i}`,
    type: cleanWorkoutType(w.type || w.workoutActivityType || w.activityType),
    startDate: parseDate(w.startDate || w.start_date),
    endDate:   parseDate(w.endDate   || w.end_date),
    duration:  Number(w.duration || w.durationInSeconds) || 0,
    calories:  Number(w.calories || w.totalEnergyBurned || w.activeEnergyBurned) || 0,
    distance:  w.distance != null ? Number(w.distance) : null,
    distanceUnit: w.distanceUnit || w.distance_unit || null,
    avgHeartRate: Number(w.avgHeartRate || w.averageHeartRate) || null,
    maxHeartRate: Number(w.maxHeartRate) || null,
  }))

  const toNum   = (v) => (v == null ? null : typeof v === 'object' ? Number(v.value ?? v.qty ?? v.count) : Number(v))
  const weightV = toNum(payload.weight)
  const stepsV  = toNum(payload.steps ?? payload.stepCount)
  const hrV     = toNum(payload.restingHeartRate ?? payload.restingHR)

  return {
    workouts,
    weight:           weightV != null ? { value: weightV, unit: typeof payload.weight === 'object' ? (payload.weight.unit || 'lbs') : 'lbs' } : null,
    steps:            stepsV  != null ? { count: stepsV } : null,
    restingHeartRate: hrV     != null ? { value: hrV }    : null,
  }
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

  // Auto-detect source format
  const normalised = payload.data ? fromHealthAutoExport(payload) : fromManual(payload)

  const record = {
    workouts:    normalised.workouts,
    healthStats: {
      weight:           normalised.weight,
      steps:            normalised.steps,
      restingHeartRate: normalised.restingHeartRate,
    },
    rings: payload.rings || null,
    lastSynced: new Date().toISOString(),
  }

  const store = getStore('health-data')
  await store.setJSON('latest', record)

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, synced: normalised.workouts.length }),
  }
}
