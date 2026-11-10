// How XP is earned, in words, for the welcome tour and the "How XP works" sheet.
// Keep in sync with the amounts in supabase/migrations (workout_xp, xp_events kinds).

export const XP_RULES: { emoji: string; what: string; xp: string }[] = [
  { emoji: '🏃', what: 'A workout that counts (Me → What counts; 30 min = 25 XP)', xp: '10–40' },
  { emoji: '📸', what: 'Add a photo to a workout', xp: '+25' },
  { emoji: '👟', what: 'Daily steps: +5 at 5k, +10 at 8k, +10 at 12k', xp: '5–25' },
  { emoji: '🔥', what: 'Hit your weekly goal', xp: '+50' },
  { emoji: '✅', what: 'A partner verifies your workout', xp: '+5' },
  { emoji: '🤝', what: 'Verify a partner’s workout (3 a day)', xp: '+2' },
  { emoji: '🎯', what: 'Finish a challenge', xp: '+100' },
  { emoji: '🎁', what: 'A friend joins with your invite and works out (they get +100 too)', xp: '+100' },
];

/** What each kind of XP event is, for "Your XP this week" breakdowns. */
export const XP_KIND_LABELS: Record<string, { emoji: string; label: string }> = {
  workout: { emoji: '🏃', label: 'Workouts' },
  evidence: { emoji: '📸', label: 'Photos' },
  steps: { emoji: '👟', label: 'Steps' },
  week_goal: { emoji: '🔥', label: 'Weekly goal' },
  verified: { emoji: '✅', label: 'Verified' },
  verifier: { emoji: '🤝', label: 'Verifying' },
  incentive: { emoji: '🎯', label: 'Challenges' },
  invite: { emoji: '🎁', label: 'Invites' },
};

/** XP totals by kind, biggest first, leaving out kinds with nothing. */
export function xpBreakdown(byKind: Record<string, number>): { kind: string; emoji: string; label: string; xp: number }[] {
  return Object.entries(byKind)
    .filter(([, xp]) => xp > 0)
    .map(([kind, xp]) => ({ kind, xp, ...(XP_KIND_LABELS[kind] ?? { emoji: '⚡', label: 'Other' }) }))
    .sort((a, b) => b.xp - a.xp);
}
