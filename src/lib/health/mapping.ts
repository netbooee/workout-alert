// Pure conversions from HealthKit values to our database rows. Kept free of
// native imports so it can be unit tested.

import { dayKey } from '@/lib/week';

export interface HealthQuantity {
  readonly unit: string;
  readonly quantity: number;
}

export function toKcal(q: HealthQuantity | undefined): number | null {
  if (!q) return null;
  switch (q.unit) {
    case 'kcal':
    case 'Cal':
      return q.quantity;
    case 'cal':
      return q.quantity / 1000;
    case 'kJ':
      return q.quantity / 4.184;
    case 'J':
      return q.quantity / 4184;
    default:
      return null;
  }
}

export function toMeters(q: HealthQuantity | undefined): number | null {
  if (!q) return null;
  switch (q.unit) {
    case 'm':
      return q.quantity;
    case 'km':
      return q.quantity * 1000;
    case 'mi':
      return q.quantity * 1609.344;
    case 'yd':
      return q.quantity * 0.9144;
    case 'ft':
      return q.quantity * 0.3048;
    default:
      return null;
  }
}

export function round(value: number | null, digits = 0): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export interface HealthWorkoutInput {
  uuid: string;
  activityType: string;
  startDate: Date;
  endDate: Date;
  totalEnergyBurned?: HealthQuantity;
  totalDistance?: HealthQuantity;
  avgHeartRate?: number;
  maxHeartRate?: number;
}

export interface WorkoutRow {
  source: 'healthkit';
  external_id: string;
  activity_type: string;
  started_at: string;
  ended_at: string;
  duration_s: number;
  active_kcal: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
}

export function toWorkoutRow(w: HealthWorkoutInput): WorkoutRow {
  return {
    source: 'healthkit',
    external_id: w.uuid,
    activity_type: w.activityType,
    started_at: w.startDate.toISOString(),
    ended_at: w.endDate.toISOString(),
    duration_s: Math.max(0, Math.round((w.endDate.getTime() - w.startDate.getTime()) / 1000)),
    active_kcal: round(toKcal(w.totalEnergyBurned)),
    distance_m: round(toMeters(w.totalDistance)),
    avg_hr: round(w.avgHeartRate ?? null),
    max_hr: round(w.maxHeartRate ?? null),
  };
}

export interface DailyStat {
  startDate?: Date;
  value?: number;
}

export interface DailyActivityRow {
  day: string;
  steps: number | null;
  active_kcal: number | null;
  exercise_min: number | null;
  resting_hr: number | null;
}

/** Merge per-day statistics collections into one row per local day. */
export function mergeDailyStats(stats: {
  steps: readonly DailyStat[];
  activeKcal: readonly DailyStat[];
  exerciseMin: readonly DailyStat[];
  restingHr: readonly DailyStat[];
}): DailyActivityRow[] {
  const rows = new Map<string, DailyActivityRow>();
  const put = (list: readonly DailyStat[], field: Exclude<keyof DailyActivityRow, 'day'>) => {
    for (const s of list) {
      if (!s.startDate || s.value == null) continue;
      const day = dayKey(s.startDate);
      const row = rows.get(day) ?? {
        day,
        steps: null,
        active_kcal: null,
        exercise_min: null,
        resting_hr: null,
      };
      row[field] = Math.round(s.value);
      rows.set(day, row);
    }
  };
  put(stats.steps, 'steps');
  put(stats.activeKcal, 'active_kcal');
  put(stats.exerciseMin, 'exercise_min');
  put(stats.restingHr, 'resting_hr');
  return [...rows.values()].sort((a, b) => a.day.localeCompare(b.day));
}
