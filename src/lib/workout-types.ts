import type { SFSymbol } from 'expo-symbols';

// Display info for HealthKit workout activity types (stored by enum name,
// e.g. 'traditionalStrengthTraining'). Unlisted types fall back to a
// humanized name and a generic icon.
const KNOWN: Record<string, { label: string; icon: SFSymbol }> = {
  running: { label: 'Run', icon: 'figure.run' },
  walking: { label: 'Walk', icon: 'figure.walk' },
  hiking: { label: 'Hike', icon: 'figure.hiking' },
  cycling: { label: 'Ride', icon: 'figure.outdoor.cycle' },
  swimming: { label: 'Swim', icon: 'figure.pool.swim' },
  traditionalStrengthTraining: { label: 'Strength', icon: 'figure.strengthtraining.traditional' },
  functionalStrengthTraining: { label: 'Functional Strength', icon: 'figure.strengthtraining.functional' },
  highIntensityIntervalTraining: { label: 'HIIT', icon: 'figure.highintensity.intervaltraining' },
  crossTraining: { label: 'Cross Training', icon: 'figure.cross.training' },
  yoga: { label: 'Yoga', icon: 'figure.yoga' },
  pilates: { label: 'Pilates', icon: 'figure.pilates' },
  rowing: { label: 'Row', icon: 'figure.rower' },
  elliptical: { label: 'Elliptical', icon: 'figure.elliptical' },
  stairClimbing: { label: 'Stairs', icon: 'figure.stair.stepper' },
  coreTraining: { label: 'Core', icon: 'figure.core.training' },
  dance: { label: 'Dance', icon: 'figure.dance' },
  tennis: { label: 'Tennis', icon: 'figure.tennis' },
  basketball: { label: 'Basketball', icon: 'figure.basketball' },
  soccer: { label: 'Soccer', icon: 'figure.indoor.soccer' },
  golf: { label: 'Golf', icon: 'figure.golf' },
  boxing: { label: 'Boxing', icon: 'figure.boxing' },
  mindAndBody: { label: 'Mind & Body', icon: 'figure.mind.and.body' },
  cooldown: { label: 'Cooldown', icon: 'figure.cooldown' },
};

export function workoutLabel(activityType: string): string {
  return KNOWN[activityType]?.label ?? humanize(activityType);
}

export function workoutIcon(activityType: string): SFSymbol {
  return KNOWN[activityType]?.icon ?? 'figure.mixed.cardio';
}

function humanize(camel: string): string {
  const spaced = camel.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
