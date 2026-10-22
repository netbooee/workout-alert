// Daily step tiers, mirroring public.step_tiers() in
// supabase/migrations/20261027000000_step_xp.sql. XP only: steps never count
// toward streaks or challenges.

export const STEP_TIERS = [
  { steps: 5000, xp: 5 },
  { steps: 8000, xp: 10 },
  { steps: 12000, xp: 10 },
] as const;

/** XP a day's steps have earned. */
export function stepXp(steps: number): number {
  return STEP_TIERS.filter((t) => steps >= t.steps).reduce((sum, t) => sum + t.xp, 0);
}

/** The next tier still to reach today, or null once all are done. */
export function nextStepTier(steps: number): (typeof STEP_TIERS)[number] | null {
  return STEP_TIERS.find((t) => steps < t.steps) ?? null;
}

/** The step count of a tier from its xp_events ref ('YYYY-MM-DD:8000'). */
export function tierFromRef(ref: string): number {
  return Number(ref.split(':')[1]) || 0;
}
