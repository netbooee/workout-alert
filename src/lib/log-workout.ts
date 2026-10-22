// Rules for logging a workout by hand. No native imports, so it stays unit-testable.

export const MIN_LOG_MINUTES = 5;
export const MAX_LOG_MINUTES = 300;
export const LOG_MINUTES_STEP = 5;
/** How far back a workout can be logged. */
export const LOG_BACK_DAYS = 14;

export function clampMinutes(minutes: number): number {
  return Math.min(Math.max(Math.round(minutes), MIN_LOG_MINUTES), MAX_LOG_MINUTES);
}

/** Start and end of a workout that finished at `finishedAt` (never in the future). */
export function logWindow(finishedAt: Date, minutes: number, now: Date = new Date()): { started: Date; ended: Date } {
  const ended = finishedAt > now ? now : finishedAt;
  return { started: new Date(ended.getTime() - clampMinutes(minutes) * 60_000), ended };
}

/** "45 min", "1 h 30 min". */
export function minutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
