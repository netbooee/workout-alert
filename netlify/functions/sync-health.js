import { getStore } from '@netlify/blobs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  // Normalize and assign IDs to workouts
  const workouts = (payload.workouts || []).map((w, i) => ({
    id: `${Date.now()}-${i}`,
    type: w.type || 'Workout',
    startDate: w.startDate,
    endDate: w.endDate,
    duration: Number(w.duration) || 0,
    calories: Number(w.calories || w.totalEnergyBurned) || 0,
    distance: Number(w.distance || w.totalDistance) || null,
    avgHeartRate: Number(w.avgHeartRate || w.averageHeartRate) || null,
    maxHeartRate: Number(w.maxHeartRate) || null,
  }))

  const record = {
    workouts,
    healthStats: {
      weight: payload.weight || null,
      steps: payload.steps || null,
      restingHeartRate: payload.restingHeartRate || null,
    },
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
