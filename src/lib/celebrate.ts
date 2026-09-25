// Decides when to show the "+XP" celebration after new activity arrives.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export interface Celebration {
  xp: number;
  workouts: number;
  weekGoal: boolean;
  evidence: boolean;
}

const key = (userId: string) => `celebrate:last-seen:${userId}`;
/** Older activity (e.g. the first 12-week backfill) never triggers a celebration. */
const RECENT_MS = 3 * 24 * 3600 * 1000;

/**
 * Returns what was earned since the last celebration, or null if nothing new.
 * The very first call just records a baseline.
 */
export async function takeCelebration(userId: string): Promise<Celebration | null> {
  const lastSeen = await AsyncStorage.getItem(key(userId));
  const now = new Date().toISOString();
  if (!lastSeen) {
    await AsyncStorage.setItem(key(userId), now);
    return null;
  }

  const { data, error } = await supabase
    .from('xp_events')
    .select('kind, amount, awarded_at')
    .eq('user_id', userId)
    .gt('awarded_at', lastSeen)
    .gte('created_at', new Date(Date.now() - RECENT_MS).toISOString());
  if (error) throw error;

  await AsyncStorage.setItem(key(userId), now);
  if (!data.length) return null;

  return {
    xp: data.reduce((sum, e) => sum + e.amount, 0),
    workouts: data.filter((e) => e.kind === 'workout').length,
    weekGoal: data.some((e) => e.kind === 'week_goal'),
    evidence: data.some((e) => e.kind === 'evidence'),
  };
}

/** Opens the celebration screen if anything new was earned. */
export async function showCelebrationIfEarned(userId: string): Promise<void> {
  const earned = await takeCelebration(userId);
  if (!earned) return;
  // Imported lazily so this module stays usable outside the router (e.g. tests).
  const { router } = await import('expo-router');
  router.push({
    pathname: '/celebrate',
    params: {
      xp: String(earned.xp),
      workouts: String(earned.workouts),
      weekGoal: earned.weekGoal ? '1' : '0',
      evidence: earned.evidence ? '1' : '0',
    },
  });
}
