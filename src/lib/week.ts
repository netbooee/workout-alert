// Week math for the UI. Weeks run Sunday–Saturday in the device's local time,
// matching the server's streak engine (which uses the profile timezone, kept
// in sync with the device on every health sync).

export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Sunday 00:00 local time of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay()); // Sun=0
}

export interface WorkoutLike {
  started_at: string;
  duration_s: number;
  /** False when it's under the owner's "What counts" bar (set by the database). */
  counted?: boolean;
}

export interface WeekDay {
  key: string;
  label: (typeof DAY_LABELS)[number];
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/** The seven days of the current week, flagged by whether a qualifying workout happened. */
export function buildWeek(
  workouts: readonly WorkoutLike[],
  minWorkoutMinutes: number,
  now: Date = new Date(),
): WeekDay[] {
  const activeDays = new Set(
    workouts
      .filter((w) => w.counted !== false && w.duration_s >= minWorkoutMinutes * 60)
      .map((w) => dayKey(new Date(w.started_at))),
  );
  const sunday = startOfWeek(now);
  const todayKey = dayKey(now);

  return DAY_LABELS.map((label, i) => {
    const day = addDays(sunday, i);
    const key = dayKey(day);
    return {
      key,
      label,
      active: activeDays.has(key),
      isToday: key === todayKey,
      isFuture: day > now && key !== todayKey,
    };
  });
}

export type WeekState =
  | { kind: 'done' }
  | { kind: 'on-track'; needed: number; daysLeft: number }
  | { kind: 'at-risk'; needed: number; daysLeft: number }
  | { kind: 'out-of-reach'; needed: number; daysLeft: number };

/**
 * How this week is going. Days left includes today. "At risk" means every
 * remaining day (or all but one) needs a workout to hit the goal.
 */
export function weekState(activeDays: number, goal: number, now: Date = new Date()): WeekState {
  const needed = Math.max(goal - activeDays, 0);
  if (needed === 0) return { kind: 'done' };

  const daysLeft = 7 - now.getDay();
  if (needed > daysLeft) return { kind: 'out-of-reach', needed, daysLeft };
  if (daysLeft - needed <= 1) return { kind: 'at-risk', needed, daysLeft };
  return { kind: 'on-track', needed, daysLeft };
}
