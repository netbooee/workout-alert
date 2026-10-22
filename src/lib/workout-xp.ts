// XP for one workout, mirroring the server (public.workout_xp and
// public.sync_workout_xp / verification_xp). Keep the amounts in sync with
// supabase/migrations and src/lib/xp-rules.ts.

export const PHOTO_XP = 25;
export const VERIFIED_XP = 5;

/** 10 XP for showing up, +1 per 2 minutes up to an hour. Under 5 minutes earns nothing. */
export function durationXp(durationS: number): number {
  if (durationS < 300) return 0;
  return 10 + Math.floor(Math.min(Math.floor(durationS / 60), 60) / 2);
}

export interface WorkoutXpInput {
  durationS: number;
  /** Passes the owner's "What counts" bar; workouts that don't count earn nothing. */
  counted: boolean;
  hasPhoto: boolean;
  /** A partner has ✅ verified it. */
  verified: boolean;
}

export interface WorkoutXp {
  earned: number;
  /** What the workout could still earn: a photo and a partner's ✅. */
  photoLeft: number;
  verifyLeft: number;
  /** earned plus everything still on the table. */
  potential: number;
}

export function workoutXp({ durationS, counted, hasPhoto, verified }: WorkoutXpInput): WorkoutXp {
  if (!counted) return { earned: 0, photoLeft: 0, verifyLeft: 0, potential: 0 };
  const earned = durationXp(durationS) + (hasPhoto ? PHOTO_XP : 0) + (verified ? VERIFIED_XP : 0);
  const photoLeft = hasPhoto ? 0 : PHOTO_XP;
  const verifyLeft = verified ? 0 : VERIFIED_XP;
  return { earned, photoLeft, verifyLeft, potential: earned + photoLeft + verifyLeft };
}

/** Whether anyone but the owner has verified a workout. */
export function isVerified(ownerId: string, reactions: { kind: string; user_id: string }[]): boolean {
  return reactions.some((r) => r.kind === 'verified' && r.user_id !== ownerId);
}
