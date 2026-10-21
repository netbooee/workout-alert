// "What counts" rules: the shortest workout that counts, and a separate bar for
// walks. Mirrors public.workout_counts() in
// supabase/migrations/20261022000000_what_counts.sql. No native imports, so it
// stays unit-testable.

export interface CountRules {
  min_workout_minutes: number;
  /** null: same as min_workout_minutes. */
  min_walk_minutes: number | null;
  count_walks: boolean;
}

export const MIN_WORKOUT_OPTIONS = [10, 15, 20, 30] as const;

/** Choices for walks: the same bar as everything else, a higher one, or never. */
export type WalkChoice = 'same' | '20' | '30' | '45' | 'never';
export const WALK_OPTIONS: { key: WalkChoice; label: string }[] = [
  { key: 'same', label: 'Same' },
  { key: '20', label: '20m' },
  { key: '30', label: '30m' },
  { key: '45', label: '45m' },
  { key: 'never', label: 'Never' },
];

export function walkChoice(r: CountRules): WalkChoice {
  if (!r.count_walks) return 'never';
  if (r.min_walk_minutes == null) return 'same';
  return (['20', '30', '45'] as const).find((k) => Number(k) === r.min_walk_minutes) ?? 'same';
}

/** The profile fields to save for a walk choice. */
export function walkRules(choice: WalkChoice): Pick<CountRules, 'min_walk_minutes' | 'count_walks'> {
  if (choice === 'never') return { min_walk_minutes: null, count_walks: false };
  if (choice === 'same') return { min_walk_minutes: null, count_walks: true };
  return { min_walk_minutes: Number(choice), count_walks: true };
}

export function countsAsWorkout(w: { activity_type: string; duration_s: number }, r: CountRules): boolean {
  if (w.activity_type === 'walking') {
    if (!r.count_walks) return false;
    return w.duration_s >= (r.min_walk_minutes ?? r.min_workout_minutes) * 60;
  }
  return w.duration_s >= r.min_workout_minutes * 60;
}

/** "Workouts count from 15 minutes; walks from 30." */
export function rulesSummary(r: CountRules): string {
  const base = `Workouts count from ${r.min_workout_minutes} minutes`;
  if (!r.count_walks) return `${base}; walks don’t count.`;
  if (r.min_walk_minutes == null || r.min_walk_minutes === r.min_workout_minutes) return `${base}, walks included.`;
  return `${base}; walks from ${r.min_walk_minutes}.`;
}
