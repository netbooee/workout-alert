// Decides when to show the "+XP" celebration after new activity arrives.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { tierFromRef } from '@/lib/step-xp';
import { supabase } from '@/lib/supabase';

export interface Celebration {
  xp: number;
  workouts: number;
  weekGoal: boolean;
  evidence: boolean;
  incentive: boolean;
  /** inviter: someone you invited just worked out; welcome: you joined with an invite. */
  invite: 'inviter' | 'welcome' | null;
  /** The highest step tier just reached (e.g. 8000), or 0. */
  steps: number;
}

const key = (userId: string) => `celebrate:last-seen:${userId}`;
/** Older activity (e.g. the first 12-week backfill) never triggers a celebration. */
const RECENT_MS = 3 * 24 * 3600 * 1000;

/**
 * Returns what was earned since the last celebration, or null if nothing new.
 * On a device's first call, a new account counts from when it finished
 * onboarding, so the first workout celebrates. An older account (a reinstall)
 * just records a baseline instead of replaying what it already saw.
 */
export async function takeCelebration(userId: string): Promise<Celebration | null> {
  const now = new Date().toISOString();
  const lastSeen = (await AsyncStorage.getItem(key(userId))) ?? (await newAccountBaseline(userId));
  if (!lastSeen) {
    await AsyncStorage.setItem(key(userId), now);
    return null;
  }

  const { data, error } = await supabase
    .from('xp_events')
    .select('kind, ref, amount, awarded_at')
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
    incentive: data.some((e) => e.kind === 'incentive'),
    invite: data.some((e) => e.kind === 'invite' && e.ref === 'welcome')
      ? 'welcome'
      : data.some((e) => e.kind === 'invite')
        ? 'inviter'
        : null,
    steps: Math.max(0, ...data.filter((e) => e.kind === 'steps').map((e) => tierFromRef(e.ref))),
  };
}

async function newAccountBaseline(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const onboardedAt = data.onboarded_at;
  if (!onboardedAt || Date.now() - new Date(onboardedAt).getTime() > RECENT_MS) return null;
  return onboardedAt;
}

/**
 * Opens the celebration screen if anything new was earned. After logging a
 * workout, `logged` lets it offer Share and say when the workout is under
 * your "What counts" bar.
 */
export async function showCelebrationIfEarned(
  userId: string,
  logged?: { workoutId: string; counted: boolean },
): Promise<void> {
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
      incentive: earned.incentive ? '1' : '0',
      invite: earned.invite ?? '',
      steps: String(earned.steps),
      workoutId: logged?.workoutId ?? '',
      uncounted: logged && !logged.counted ? '1' : '0',
    },
  });
}
