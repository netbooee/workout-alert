import { describe, expect, it } from 'vitest';

import { mergeDailyStats, toKcal, toMeters, toWorkoutRow } from './mapping';

describe('unit conversion', () => {
  it('converts energy units to kcal', () => {
    expect(toKcal({ unit: 'kcal', quantity: 300 })).toBe(300);
    expect(toKcal({ unit: 'kJ', quantity: 4184 })).toBeCloseTo(1000);
    expect(toKcal({ unit: 'furlongs', quantity: 1 })).toBeNull();
    expect(toKcal(undefined)).toBeNull();
  });

  it('converts distance units to meters', () => {
    expect(toMeters({ unit: 'km', quantity: 5 })).toBe(5000);
    expect(toMeters({ unit: 'mi', quantity: 1 })).toBeCloseTo(1609.344);
  });
});

describe('toWorkoutRow', () => {
  it('maps a HealthKit workout to a database row', () => {
    const row = toWorkoutRow({
      uuid: 'ABC-123',
      activityType: 'running',
      startDate: new Date('2026-09-24T12:00:00Z'),
      endDate: new Date('2026-09-24T12:42:30Z'),
      totalEnergyBurned: { unit: 'kcal', quantity: 412.6 },
      totalDistance: { unit: 'km', quantity: 7.21 },
      avgHeartRate: 151.4,
      maxHeartRate: 178,
      sourceName: "Jordan's Apple Watch",
    });
    expect(row).toEqual({
      source: 'healthkit',
      external_id: 'ABC-123',
      activity_type: 'running',
      started_at: '2026-09-24T12:00:00.000Z',
      ended_at: '2026-09-24T12:42:30.000Z',
      duration_s: 2550,
      active_kcal: 413,
      distance_m: 7210,
      avg_hr: 151,
      max_hr: 178,
      source_name: "Jordan's Apple Watch",
    });
  });

  it('leaves missing metrics null', () => {
    const row = toWorkoutRow({
      uuid: 'x',
      activityType: 'yoga',
      startDate: new Date('2026-09-24T12:00:00Z'),
      endDate: new Date('2026-09-24T12:30:00Z'),
    });
    expect(row.active_kcal).toBeNull();
    expect(row.distance_m).toBeNull();
    expect(row.avg_hr).toBeNull();
  });
});

describe('mergeDailyStats', () => {
  it('merges stats into one row per local day', () => {
    const mon = new Date(2026, 8, 21);
    const tue = new Date(2026, 8, 22);
    const rows = mergeDailyStats({
      steps: [{ startDate: mon, value: 8123.4 }, { startDate: tue, value: 501 }],
      activeKcal: [{ startDate: mon, value: 420.2 }],
      exerciseMin: [{ startDate: tue, value: 31 }],
      restingHr: [{ startDate: mon, value: 58.6 }, { startDate: tue }],
    });
    expect(rows).toEqual([
      { day: '2026-09-21', steps: 8123, active_kcal: 420, exercise_min: null, resting_hr: 59 },
      { day: '2026-09-22', steps: 501, active_kcal: null, exercise_min: 31, resting_hr: null },
    ]);
  });
});
