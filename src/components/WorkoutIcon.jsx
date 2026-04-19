const CONFIGS = {
  Running:          { emoji: '🏃', bg: 'from-orange-500 to-red-500' },
  Walking:          { emoji: '🚶', bg: 'from-green-500 to-emerald-600' },
  Cycling:          { emoji: '🚴', bg: 'from-yellow-500 to-orange-500' },
  Swimming:         { emoji: '🏊', bg: 'from-blue-500 to-cyan-500' },
  'Strength Training': { emoji: '🏋️', bg: 'from-purple-500 to-violet-600' },
  'Functional Strength Training': { emoji: '🏋️', bg: 'from-purple-500 to-violet-600' },
  HIIT:             { emoji: '💪', bg: 'from-red-500 to-pink-600' },
  Yoga:             { emoji: '🧘', bg: 'from-teal-500 to-cyan-600' },
  Hiking:           { emoji: '🥾', bg: 'from-lime-600 to-green-700' },
  Rowing:           { emoji: '🚣', bg: 'from-blue-600 to-indigo-600' },
  Elliptical:       { emoji: '🔄', bg: 'from-indigo-500 to-blue-600' },
  'Stair Climbing': { emoji: '🪜', bg: 'from-amber-500 to-orange-600' },
  Soccer:           { emoji: '⚽', bg: 'from-green-600 to-emerald-700' },
  Basketball:       { emoji: '🏀', bg: 'from-orange-600 to-amber-600' },
  Tennis:           { emoji: '🎾', bg: 'from-lime-500 to-green-600' },
  Golf:             { emoji: '⛳', bg: 'from-green-700 to-teal-700' },
  Dance:            { emoji: '💃', bg: 'from-pink-500 to-rose-600' },
  Pilates:          { emoji: '🤸', bg: 'from-rose-400 to-pink-500' },
}

const DEFAULT = { emoji: '🏅', bg: 'from-apple-blue to-blue-600' }

export function workoutConfig(type = '') {
  return CONFIGS[type] || DEFAULT
}

export default function WorkoutIcon({ type, size = 'md' }) {
  const { emoji, bg } = workoutConfig(type)
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-3xl' : 'w-12 h-12 text-2xl'

  return (
    <div className={`${sizeClass} rounded-apple bg-gradient-to-br ${bg} flex items-center justify-center flex-shrink-0 shadow-lg`}>
      {emoji}
    </div>
  )
}
