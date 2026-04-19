import { getStore } from '@netlify/blobs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// Demo data shown before any real sync has happened
const DEMO = {
  workouts: [
    {
      id: 'demo-1',
      type: 'Running',
      startDate: new Date(Date.now() - 5 * 3600000).toISOString(),
      endDate: new Date(Date.now() - 3.5 * 3600000).toISOString(),
      duration: 1920,
      calories: 487,
      distance: 5842,
      avgHeartRate: 152,
      maxHeartRate: 174,
    },
    {
      id: 'demo-2',
      type: 'Strength Training',
      startDate: new Date(Date.now() - 10 * 3600000).toISOString(),
      endDate: new Date(Date.now() - 9 * 3600000).toISOString(),
      duration: 3480,
      calories: 312,
      distance: null,
      avgHeartRate: 131,
      maxHeartRate: 158,
    },
  ],
  healthStats: {
    weight: { value: 183.4, unit: 'lbs' },
    steps: { count: 9217 },
    restingHeartRate: { value: 56 },
  },
  rings: {
    move: { current: 487, goal: 600 },
    exercise: { current: 87, goal: 60 },
    stand: { current: 10, goal: 12 },
  },
  lastSynced: null,
  isDemo: true,
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let data
  try {
    const store = getStore('health-data')
    data = await store.get('latest', { type: 'json' })
  } catch {
    data = null
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data || DEMO),
  }
}
