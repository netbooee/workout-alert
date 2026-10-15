import { Appearance, DynamicColorIOS, Platform, type ColorValue } from 'react-native';

// One hot accent (flame orange) reserved for streaks, on a near-black (dark) or
// iOS grouped-gray (light) background. Text on accent fills stays black in both.

const dark = {
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
  xp: '#FFD60A',
  rest: '#8B96E9',
  xpSoft: 'rgba(255, 214, 10, 0.16)',
  danger: '#F87171',

  ringMove: '#FF375F',
  ringExercise: '#9BF03C',
  ringSteps: '#3BD1FF',
};

type ColorName = keyof typeof dark;

const light: Record<ColorName, string> = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  cardRaised: '#EBEBF0',
  border: '#E3E3E8',
  text: '#0B0B0F',
  textSecondary: '#6B6B76',
  textMuted: '#A1A1AA',

  flame: '#FF6B1A',
  flameSoft: 'rgba(255, 107, 26, 0.14)',
  freeze: '#0EA5E9',
  freezeSoft: 'rgba(14, 165, 233, 0.14)',
  success: '#059669',
  xp: '#E0A200',
  rest: '#6366F1',
  xpSoft: 'rgba(224, 162, 0, 0.16)',
  danger: '#DC2626',

  ringMove: '#FF2D55',
  ringExercise: '#5FC40E',
  ringSteps: '#0EA5E9',
};

/** Plain hex values per scheme, for code that needs strings (e.g. the navigation theme). */
export const Palettes = { light, dark };

/**
 * Theme colors. On iOS each one is a dynamic color that the system resolves for
 * the current light/dark appearance, so they work in static StyleSheets and
 * switch instantly. Elsewhere (the web preview) they're fixed at load.
 */
export const Colors = Object.fromEntries(
  (Object.keys(dark) as ColorName[]).map((name) => [
    name,
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: light[name], dark: dark[name] })
      : (Appearance.getColorScheme() === 'light' ? light : dark)[name],
  ]),
) as Record<ColorName, ColorValue>;

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
