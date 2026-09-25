// Pulls new HealthKit data and upserts it into Supabase. Workouts use an
// anchored query so each sync only sends what changed (including deletions);
// daily totals are re-sent for the last two weeks since they change all day.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchDailyStats, fetchWorkoutChanges } from '@/lib/health/healthkit';
import { mergeDailyStats, toWorkoutRow } from '@/lib/health/mapping';
import { supabase } from '@/lib/supabase';
import { addDays, startOfWeek } from '@/lib/week';

/** How far back the first sync looks, so existing streaks show up on day one. */
const INITIAL_LOOKBACK_WEEKS = 12;
const DAILY_LOOKBACK_DAYS = 14;
const UPSERT_CHUNK = 200;

interface WorkoutSyncState {
  anchor: string;
  since: string;
}

const stateKey = (userId: string) => `healthkit:workouts:${userId}`;

async function loadState(userId: string): Promise<WorkoutSyncState | null> {
  const raw = await AsyncStorage.getItem(stateKey(userId));
  return raw ? (JSON.parse(raw) as WorkoutSyncState) : null;
}

export interface SyncResult {
  workoutsUpserted: number;
  workoutsDeleted: number;
  daysUpserted: number;
}

let inFlight: Promise<SyncResult> | null = null;

/** Sync HealthKit → Supabase. Concurrent calls share one run. */
export function syncHealthData(userId: string): Promise<SyncResult> {
  inFlight ??= runSync(userId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(userId: string): Promise<SyncResult> {
  await syncTimezone(userId);

  const state = await loadState(userId);
  const firstSync = !state;
  const since = state
    ? new Date(state.since)
    : addDays(startOfWeek(new Date()), -7 * INITIAL_LOOKBACK_WEEKS);

  // Workouts
  const changes = await fetchWorkoutChanges(since, state?.anchor);
  const rows = changes.workouts.map((w) => ({ ...toWorkoutRow(w), user_id: userId }));
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabase
      .from('workouts')
      .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'user_id,source,external_id' });
    if (error) throw error;
  }
  if (changes.deletedIds.length) {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('source', 'healthkit')
      .in('external_id', changes.deletedIds);
    if (error) throw error;
  }
  // Only advance the anchor once the server has everything up to it.
  await AsyncStorage.setItem(
    stateKey(userId),
    JSON.stringify({ anchor: changes.newAnchor, since: since.toISOString() } satisfies WorkoutSyncState),
  );

  // Daily totals
  const dailySince = firstSync ? since : addDays(new Date(), -DAILY_LOOKBACK_DAYS);
  const days = mergeDailyStats(await fetchDailyStats(dailySince)).map((d) => ({
    ...d,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }));
  if (days.length) {
    const { error } = await supabase.from('daily_activity').upsert(days, { onConflict: 'user_id,day' });
    if (error) throw error;
  }

  return {
    workoutsUpserted: rows.length,
    workoutsDeleted: changes.deletedIds.length,
    daysUpserted: days.length,
  };
}

/** Keep the profile timezone matching the device so streak weeks line up. */
async function syncTimezone(userId: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timezone) return;
  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', userId)
    .neq('timezone', timezone);
  if (error) throw error;
}

/** Forget the sync anchor so the next sync re-reads the full lookback window. */
export async function resetHealthSync(userId: string) {
  await AsyncStorage.removeItem(stateKey(userId));
}
