// Thin wrapper over @kingstinct/react-native-healthkit: permissions and the
// queries we sync. Everything returned here is plain data (no native proxies).

import {
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamplesWithAnchor,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
  type QuantityTypeIdentifier,
  type StatisticsOptions,
} from '@kingstinct/react-native-healthkit';

import type { DailyStat, HealthWorkoutInput } from '@/lib/health/mapping';
import { startOfDay } from '@/lib/week';

const READ_TYPES = [
  WorkoutTypeIdentifier,
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
] as const;

export function healthAvailable(): boolean {
  return isHealthDataAvailable();
}

/**
 * Shows the Health permission sheet (only the first time; iOS remembers the
 * answer). iOS never reveals whether read access was denied, so a denied
 * permission simply looks like no data.
 */
export async function requestHealthPermissions(): Promise<void> {
  await requestAuthorization({ toRead: READ_TYPES });
}

export interface WorkoutChanges {
  workouts: HealthWorkoutInput[];
  deletedIds: string[];
  newAnchor: string;
}

/** Workouts added or deleted since `anchor` (or since `since` on the first sync). */
export async function fetchWorkoutChanges(since: Date, anchor?: string): Promise<WorkoutChanges> {
  const res = await queryWorkoutSamplesWithAnchor({
    limit: 0,
    anchor,
    filter: { date: { startDate: since } },
  });

  const workouts: HealthWorkoutInput[] = [];
  for (const w of res.workouts) {
    let avgHeartRate: number | undefined;
    let maxHeartRate: number | undefined;
    try {
      const hr = await w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
      avgHeartRate = hr?.averageQuantity?.quantity;
      maxHeartRate = hr?.maximumQuantity?.quantity;
    } catch {
      // No heart rate recorded for this workout (e.g. logged manually).
    }
    workouts.push({
      uuid: w.uuid,
      activityType: WorkoutActivityType[w.workoutActivityType] ?? 'other',
      startDate: w.startDate,
      endDate: w.endDate,
      totalEnergyBurned: w.totalEnergyBurned,
      totalDistance: w.totalDistance,
      avgHeartRate,
      maxHeartRate,
    });
    w.dispose();
  }

  return {
    workouts,
    deletedIds: res.deletedSamples.map((d) => d.uuid),
    newAnchor: res.newAnchor,
  };
}

async function dailyCollection(
  identifier: QuantityTypeIdentifier,
  statistic: StatisticsOptions,
  unit: string,
  since: Date,
): Promise<DailyStat[]> {
  const results = await queryStatisticsCollectionForQuantity(
    identifier,
    [statistic],
    startOfDay(new Date()),
    { day: 1 },
    { filter: { date: { startDate: since } }, unit },
  );
  return results.map((r) => ({
    startDate: r.startDate,
    value: (statistic === 'cumulativeSum' ? r.sumQuantity : r.averageQuantity)?.quantity,
  }));
}

export async function fetchDailyStats(since: Date) {
  const [steps, activeKcal, exerciseMin, restingHr] = await Promise.all([
    dailyCollection('HKQuantityTypeIdentifierStepCount', 'cumulativeSum', 'count', since),
    dailyCollection('HKQuantityTypeIdentifierActiveEnergyBurned', 'cumulativeSum', 'kcal', since),
    dailyCollection('HKQuantityTypeIdentifierAppleExerciseTime', 'cumulativeSum', 'min', since),
    dailyCollection('HKQuantityTypeIdentifierRestingHeartRate', 'discreteAverage', 'count/min', since),
  ]);
  return { steps, activeKcal, exerciseMin, restingHr };
}
