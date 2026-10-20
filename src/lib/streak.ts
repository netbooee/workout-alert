// Streak milestones and freeze progress. Mirrors public.recompute_streak:
// every 4th goal week in a row banks a freeze (up to 2). A missed week resets
// both the streak and the freeze count-up, and frozen or rest weeks change
// neither, so the count-up is always the current streak modulo 4.

export const WEEKS_PER_FREEZE = 4;
export const MAX_FREEZES = 2;
export const MILESTONES = [2, 4, 8, 12, 26, 52, 104] as const;

/** Goal weeks still needed to bank the next freeze (1–4). */
export function weeksToNextFreeze(currentWeeks: number): number {
  return WEEKS_PER_FREEZE - (Math.max(currentWeeks, 0) % WEEKS_PER_FREEZE);
}

/** True when the week that just made the streak `currentWeeks` long also banked a freeze. */
export function earnedFreezeAt(currentWeeks: number): boolean {
  return currentWeeks > 0 && currentWeeks % WEEKS_PER_FREEZE === 0;
}

/** The next milestone above the current streak, or null past the last one. */
export function nextMilestone(currentWeeks: number): number | null {
  return MILESTONES.find((m) => m > currentWeeks) ?? null;
}

/** True when the streak has just reached one of the milestones. */
export function isMilestone(currentWeeks: number): boolean {
  return (MILESTONES as readonly number[]).includes(currentWeeks);
}

/** "8 weeks", "1 year", "2 years". */
export function milestoneLabel(weeks: number): string {
  if (weeks % 52 === 0) {
    const years = weeks / 52;
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  return `${weeks} weeks`;
}
