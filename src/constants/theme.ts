// Dark-only palette with one hot accent (flame orange) reserved for streaks.

export const Colors = {
  background: '#0B0B0F',
  card: '#16161D',
  cardRaised: '#1E1E27',
  border: '#26262F',
  text: '#F5F5F7',
  textSecondary: '#9A9AA5',
  textMuted: '#5F5F6B',

  flame: '#FF6B1A',
  flameSoft: 'rgba(255, 107, 26, 0.16)',
  freeze: '#7DD3FC',
  freezeSoft: 'rgba(125, 211, 252, 0.16)',
  success: '#34D399',
  danger: '#F87171',

  ringMove: '#FF375F',
  ringExercise: '#9BF03C',
  ringSteps: '#3BD1FF',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const Font = {
  // SF Pro Rounded on iOS gives numbers a friendlier, game-like feel.
  rounded: 'ui-rounded',
} as const;

/** Daily ring targets. Fixed for now; could move to the profile later. */
export const DailyTargets = {
  activeKcal: 500,
  exerciseMin: 30,
  steps: 8000,
} as const;
