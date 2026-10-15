// Voice message limits and formatting. No native imports, so it stays unit-testable.

/** Voice messages are capped at 30 seconds (enforced again in the database). */
export const MAX_VOICE_SECONDS = 30;

/** Shorter recordings are treated as accidental taps and discarded. */
export const MIN_VOICE_MS = 1000;

/** Milliseconds as m:ss, e.g. 12400 → "0:12", 30000 → "0:30". */
export function formatClip(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
